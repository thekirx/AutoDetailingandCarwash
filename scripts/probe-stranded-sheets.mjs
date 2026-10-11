/**
 * READ-ONLY readiness check: is any Daily Sheet currently stranded?
 *
 * BUG-085's guard refuses to let the submitter approve their own sheet. That is
 * the control working, but it introduces a new terminal state that did not
 * exist before: a sheet in 'submitted' or 'returned' whose ONLY eligible
 * approver is the person who filed it. Such a sheet can never be approved, and
 * reopen_daily_sheet accepts only 'approved' sheets, so there is no recovery
 * path at all.
 *
 * The migration header states the condition explicitly -- "if the Super Admin
 * account is ever deactivated and a lone ASA files a sheet" -- which is exactly
 * the kind of sentence that is true when written and false six months later.
 * Nobody has checked, because checking needs a live database and this is the
 * first run since the migration landed.
 *
 * Also checks the inverse: how many sheets are waiting for somebody at all, and
 * who. A readiness answer that only says "no stranded sheets" is incomplete if
 * forty sheets are quietly sitting in 'submitted' with no owner.
 *
 * SELECT only.
 *
 *   node scripts/probe-stranded-sheets.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findStrandedSheets } from './lib/stranded-sheets.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

const sheets = readOrFail('daily_sheets', await db.from('daily_sheets').select('id, branch, business_date, status, submitted_by, reviewed_by, submitted_at'))
const byStatus = new Map()
for (const s of sheets) byStatus.set(s.status, (byStatus.get(s.status) || 0) + 1)
console.log(`daily_sheets total ${sheets.length}`)
for (const [st, n] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${st}: ${n}`)

// Who can approve at all? The decision lives in lib/stranded-sheets.mjs so it
// can be tested against a synthetic stranded sheet -- an empty result from a
// checker that cannot detect is indistinguishable from a clean system.
const approvers = readOrFail(
  'approvers',
  await db.from('staff_profiles').select('id, full_name, role, is_active, is_archived, permission_grants'),
)
const { stranded, waiting, superAdmins, financeAsas } = findStrandedSheets(sheets, approvers)

console.log(`\neligible approvers: ${superAdmins.length} Super Admin, ${financeAsas.length} ASA with finance_view`)
for (const a of superAdmins) console.log(`  SA  ${a.full_name}`)
for (const a of financeAsas) console.log(`  ASA ${a.full_name}`)

// The approver pool is a single point of failure worth naming even on a clean
// run: BUG-085 means a sheet filed by the only eligible reviewer can never be
// approved, and reopen accepts only 'approved' sheets.
if (superAdmins.length === 0 && financeAsas.length <= 1) {
  console.log('\n  !! NO Super Admin is active and there is at most one ASA with finance_view.')
  console.log('     If that one person files a sheet, nothing can approve it and reopen will not take it.')
}

console.log(`\nsheets waiting for a reviewer: ${waiting.length}`)

if (stranded.length) {
  console.log(`\n!! ${stranded.length} STRANDED SHEET(S) — the only eligible reviewer filed them:\n`)
  for (const s of stranded) {
    const who = approvers.find((p) => p.id === s.submitted_by)
    console.log(`  ${s.branch} ${s.business_date}  submitted by ${who?.full_name || s.submitted_by}`)
    console.log(`    status=${s.status} — no eligible approver, and reopen accepts only 'approved'`)
  }
  process.exit(1)
}

console.log('\nNo stranded sheets: every waiting sheet has at least one eligible approver')
if (waiting.length) {
  const owners = new Map()
  for (const s of waiting) owners.set(s.submitted_by, (owners.get(s.submitted_by) || 0) + 1)
  console.log('\nwho is holding them up:')
  for (const [id, n] of [...owners.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${approvers.find((p) => p.id === id)?.full_name || id}: ${n}`)
  }
}