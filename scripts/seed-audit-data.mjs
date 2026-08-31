/**
 * Seed / dry-run multi-branch audit data (Bacoor + Imus).
 * Usage:
 *   node scripts/seed-audit-data.mjs --dry-run
 *   node scripts/seed-audit-data.mjs          # requires SUPABASE_SERVICE_ROLE_KEY
 *
 * Dry-run prints counts + writes docs/audits/2026-08-31/seed-fixture-summary.json
 * Live mode upserts branch_operating_hours and inserts tagged audit rows when tables allow.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { buildAuditFixture, BACOOR, IMUS, AUDIT_DAY } from '../src/lib/auditFixtures.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

const dryRun = process.argv.includes('--dry-run')
const fixture = buildAuditFixture()

function writeSummary(extra = {}) {
  const outDir = join(root, 'docs/audits/2026-08-31')
  mkdirSync(outDir, { recursive: true })
  const summary = {
    ok: true,
    mode: dryRun ? 'dry-run' : 'live',
    meta: fixture.meta,
    counts: fixture.counts,
    tables: [
      'branch_operating_hours',
      'staff_profiles',
      'staff_attendance',
      'sales',
      'expenses',
      'shift_close_reports',
      'bookings',
      'customers',
      'expense_categories',
      'expense_reports',
      'payroll_runs',
    ],
    ...extra,
  }
  writeFileSync(join(outDir, 'seed-fixture-summary.json'), JSON.stringify(summary, null, 2))
  return summary
}

if (dryRun) {
  const summary = writeSummary()
  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error(JSON.stringify({ ok: false, reason: 'missing_supabase_service_credentials', hint: 'Use --dry-run without credentials' }))
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function upsertOperatingHours() {
  const rows = fixture.operating_hours.map((r) => ({
    branch_slug: r.branch_slug,
    day_of_week: r.day_of_week,
    opens_at: r.opens_at,
    closes_at: r.closes_at,
    is_closed: r.is_closed,
  }))
  const { error } = await db.from('branch_operating_hours').upsert(rows, {
    onConflict: 'branch_slug,day_of_week',
  })
  if (error) throw new Error(`branch_operating_hours: ${error.message}`)
  return rows.length
}

async function seedTaggedExpenses() {
  // ponytail: only insert expenses tagged for audit replay; skip if table rejects shape
  const rows = fixture.expenses.map((e) => ({
    branch: e.branch,
    amount_minor: e.amount_minor,
    notes: `[audit-seed] ${e.category || e.expense_kind} ${AUDIT_DAY}`,
    expense_date: e.expense_date || AUDIT_DAY,
    status: e.status || 'posted',
  }))
  const { data, error } = await db.from('expenses').insert(rows).select('id')
  if (error) {
    console.warn(JSON.stringify({ warn: 'expenses_insert_skipped', message: error.message }))
    return 0
  }
  return data?.length || 0
}

try {
  const hoursN = await upsertOperatingHours()
  const expenseN = await seedTaggedExpenses()
  const summary = writeSummary({
    live: {
      branch_operating_hours_upserted: hoursN,
      expenses_inserted: expenseN,
      branches: [BACOOR, IMUS],
      note: 'Staff/sales/attendance live seed is optional — fixture JSON is authoritative for seam tests. Use dry-run for CI.',
    },
  })
  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }))
  process.exit(1)
}
