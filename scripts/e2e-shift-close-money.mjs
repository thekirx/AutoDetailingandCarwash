/**
 * BUG-007 residual: live RPC money path on QA sandbox date 2099-01-01.
 * BA submit_shift_close → Boss review_shift_close accept → status accepted.
 * CHEM-RECON: seed one approved inventory_recons row if none exist (QA fixture).
 *
 * Re-runnable: deletes prior 2099-01-01 bacoor close first (sandbox date only).
 * node scripts/e2e-shift-close-money.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emptyBacoorDailyReport } from '../src/lib/bacoorDailyReport.js'
import { moneySnapshotFromReport } from '../src/lib/shiftClose.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const QA_DATE = '2099-01-01'
const QA_BRANCH = 'bacoor'
const QA_RECON_NOTE = 'qa-seed-chem-recon-2099'

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1).replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && anon && service, 'missing SUPABASE_URL / anon / SERVICE_ROLE_KEY')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []

function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log('✔', name, detail)
}

// ── Reset sandbox close so this script is idempotent ───────────────────────
{
  const { error } = await admin
    .from('shift_close_reports')
    .delete()
    .eq('branch', QA_BRANCH)
    .eq('business_date', QA_DATE)
  assert(!error, `sandbox delete: ${error?.message}`)
}

const snapshot = moneySnapshotFromReport(
  emptyBacoorDailyReport({ branchSlug: QA_BRANCH, branchDisplay: 'Bacoor', date: QA_DATE }),
)

// ── money.rpc.ba_submit ────────────────────────────────────────────────────
const ba = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: baAuth, error: baErr } = await ba.auth.signInWithPassword({
  email: 'admin@hakumautocare.com',
  password: 'HakumAdmin2026!',
})
assert(!baErr && baAuth.session, `BA login: ${baErr?.message}`)

const { data: submitted, error: submitErr } = await ba.rpc('submit_shift_close', {
  payload: {
    branch: QA_BRANCH,
    business_date: QA_DATE,
    shift_ended_at: new Date(`${QA_DATE}T18:00:00+08:00`).toISOString(),
    pos_baseline: snapshot,
    submitted: snapshot,
    override_reasons: {},
  },
})
assert(!submitErr, `submit_shift_close: ${submitErr?.message}`)
const submitId = submitted?.id || submitted
assert(submitId, `money.rpc.ba_submit missing id: ${JSON.stringify(submitted)}`)
pass('money.rpc.ba_submit', String(submitId))
await ba.auth.signOut()

// ── money.rpc.boss_accept ──────────────────────────────────────────────────
const boss = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } })
const { data: bossAuth, error: bossErr } = await boss.auth.signInWithPassword({
  email: 'bossmich@hakumautocare.com',
  password: 'HakumBoss2026!',
})
assert(!bossErr && bossAuth.session, `Boss login: ${bossErr?.message}`)

const { data: reviewed, error: reviewErr } = await boss.rpc('review_shift_close', {
  payload: { id: submitId, action: 'accept', review_note: 'qa-sandbox-accept-2099' },
})
assert(!reviewErr, `review_shift_close: ${reviewErr?.message}`)
pass('money.rpc.boss_accept', JSON.stringify(reviewed))
await boss.auth.signOut()

// ── money.rpc.status_accepted ──────────────────────────────────────────────
const { data: row, error: rowErr } = await admin
  .from('shift_close_reports')
  .select('id, status, branch, business_date')
  .eq('id', submitId)
  .maybeSingle()
assert(!rowErr, rowErr?.message)
assert(row?.status === 'accepted', `expected accepted, got ${row?.status}`)
assert(row.business_date === QA_DATE, `sandbox date ${row.business_date}`)
pass('money.rpc.status_accepted', `${row.branch} ${row.business_date}`)

// ── chem.qa_seed_if_empty ──────────────────────────────────────────────────
const { count: reconApproved, error: reconErr } = await admin
  .from('inventory_recons')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'approved')
assert(!reconErr, reconErr?.message)

if ((reconApproved || 0) > 0) {
  pass('chem.qa_seed_if_empty', `already ${reconApproved} approved`)
} else {
  const { error: seedErr } = await admin.from('inventory_recons').insert({
    branch_slug: QA_BRANCH,
    week_of: QA_DATE,
    status: 'approved',
    notes: QA_RECON_NOTE,
    reviewed_at: new Date().toISOString(),
  })
  assert(!seedErr, `chem seed: ${seedErr?.message}`)
  pass('chem.qa_seed_if_empty', `inserted ${QA_RECON_NOTE}`)
}

const failed = results.filter((r) => !r.ok)
console.log(`\ne2e-shift-close-money: ${failed.length ? 'FAIL' : 'PASS'} (${results.length} checks)`)
process.exit(failed.length ? 1 : 0)
