/**
 * September 2026 test data for Bacoor + Batangas (completed cars, bookings, maintenance, attendance,
 * daily sheets approved / returned / reopened by SA and ASA). Plan: scripts/seed/september2026Plan.mjs.
 *
 *   node scripts/seed-september-2026.mjs                   # dry run: counts only, writes nothing
 *   node scripts/seed-september-2026.mjs --apply           # writes to the Supabase project in .env
 *   node scripts/seed-september-2026.mjs --resume-sheets   # rows already inserted: finish the daily sheets only
 *
 * Rows are inserted in their final state (no status UPDATEs), so the completion-SMS and queue triggers never fire.
 * Daily sheets go through the real RPCs as the Branch Admin, then SA / ASA review — no push is sent from here.
 * Remove everything with scripts/seed/wipe-september-2026.sql (see docs/qa/SEPTEMBER-2026-SEED.md).
 */
import { buildSeptemberPlan, SEED_TAG, SEED_BRANCHES, SEPTEMBER_DAYS } from './seed/september2026Plan.mjs'
import { ACCOUNTS, BATANGAS_SEED_STAFF, SALE_SELECT, SEED_PASSWORD, admin, findBatangasStaff, loadCatalog, loadStaff, login, must, url } from './seed/september2026Db.mjs'
import { computeSheetTotals, suggestSalaries, toSheetPayloadLines } from '../src/lib/dailySheet.js'
import { normalizeCompensationSettings } from '../src/lib/compensation.js'

const RESUME = process.argv.includes('--resume-sheets')
const APPLY = process.argv.includes('--apply') || RESUME

/** PostgREST bulk insert: every row needs the same keys or missing ones become NULL instead of their default. */
function uniform(rows) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] === undefined ? null : r[k]])))
}

async function insertAll(table, rows, { size = 300, upsert = null } = {}) {
  const data = uniform(rows)
  for (let i = 0; i < data.length; i += size) {
    const chunk = data.slice(i, i + size)
    const q = upsert ? admin.from(table).upsert(chunk, upsert) : admin.from(table).insert(chunk)
    must(await q, `insert ${table} [${i}]`)
  }
  console.log(`  ✔ ${table}: ${rows.length}`)
}

async function preflight() {
  const checks = await Promise.all([
    admin.from('bookings').select('id', { count: 'exact', head: true }).like('notes', `${SEED_TAG}%`),
    admin.from('vehicles').select('id', { count: 'exact', head: true }).ilike('plate_number', 'ZZ%'),
    admin.from('customers').select('id', { count: 'exact', head: true }).or('phone.like.0955500%,email.ilike.%@sep2026.hakum.test'),
    admin.from('daily_sheets').select('id', { count: 'exact', head: true }).in('branch', SEED_BRANCHES).gte('business_date', SEPTEMBER_DAYS[0]).lte('business_date', SEPTEMBER_DAYS.at(-1)),
  ])
  const [bookings, plates, customers, sheets] = checks.map((r, i) => {
    if (r.error) throw new Error(`preflight ${i}: ${r.error.message}`)
    return r.count
  })
  const problems = []
  if (bookings) problems.push(`${bookings} seed bookings already exist`)
  if (plates) problems.push(`${plates} ZZ plates already exist`)
  if (customers) problems.push(`${customers} seed customers already exist`)
  if (sheets) problems.push(`${sheets} September daily sheets already exist for bacoor/batangas`)
  if (problems.length) throw new Error(`Preflight failed — run scripts/seed/wipe-september-2026.sql first:\n  ${problems.join('\n  ')}`)
  console.log('✔ preflight: no seed rows, ZZ plates or September sheets')
}

async function ensureBatangasStaff() {
  const ids = await findBatangasStaff()
  for (const s of BATANGAS_SEED_STAFF) {
    if (ids[s.key]) continue
    if (!APPLY) {
      ids[s.key] = `dry-run-${s.key}`
      continue
    }
    const created = must(await admin.auth.admin.createUser({ email: s.email, password: SEED_PASSWORD, email_confirm: true, user_metadata: { full_name: s.full_name } }), `auth ${s.email}`)
    const id = created.user.id
    must(
      await admin.from('staff_profiles').insert({ id, full_name: s.full_name, role: s.role, branch_slug: 'batangas', is_active: true, login_email: s.email, geofence_enabled: false }),
      `staff_profiles ${s.email}`,
    )
    ids[s.key] = id
    console.log(`  ✔ created ${s.full_name}`)
  }
  return ids
}

async function insertPlan(plan) {
  await insertAll('customers', plan.customers)
  await insertAll('vehicles', plan.vehicles)
  const bookings = [...plan.bookings].sort((a, b) => a.created_at.localeCompare(b.created_at))
  await insertAll('bookings', bookings, { size: 200 })
  await insertAll('queue_events', plan.queueEvents, { size: 500 })
  await insertAll('queue_assignments', plan.assignments, { size: 500 })
  await insertAll('sales', plan.sales)
  await insertAll('sale_line_items', plan.saleLines, { size: 500 })
  await insertAll('staff_attendance', plan.attendance, { upsert: { onConflict: 'staff_id,attendance_date', ignoreDuplicates: true } })
  const vehicles = must(await admin.from('vehicles').select('id, normalized_plate_number').ilike('plate_number', 'ZZ%').limit(5000), 'vehicles')
  const vid = new Map(vehicles.map((v) => [v.normalized_plate_number, v.id]))
  await insertAll('vehicle_maintenance_schedules', plan.maintenance.map((m) => ({ ...m, vehicle_id: vid.get(m.plate_normalized) || null })))
  await insertAll('expenses', plan.bills)
}

/** Same inputs the POS Daily sheet tab loads (loadSheetContext), minus the UI. */
async function dayContext(branch, date) {
  const start = `${date}T00:00:00+08:00`
  const end = `${date}T23:59:59.999+08:00`
  const [sales, att, comp] = await Promise.all([
    admin.from('sales').select(SALE_SELECT).eq('branch', branch).in('status', ['paid', 'refunded']).gte('occurred_at', start).lte('occurred_at', end).limit(1000),
    admin.from('staff_attendance').select('staff_id, status, checked_in_at, staff_profiles(full_name, role, daily_rate_minor)').eq('branch_slug', branch).eq('attendance_date', date),
    admin.from('compensation_settings').select('*').eq('id', 1).maybeSingle(),
  ])
  const attendance = must(att, 'attendance').map((r) => ({ staff_id: r.staff_id, status: r.status, checked_in_at: r.checked_in_at, full_name: r.staff_profiles?.full_name, role: r.staff_profiles?.role, daily_rate_minor: Number(r.staff_profiles?.daily_rate_minor) || 0 }))
  const rules = normalizeCompensationSettings(must(comp, 'compensation'))
  const suggestions = suggestSalaries({ date, branch, sales: must(sales, 'sales'), attendance, rules, dailyRates: Object.fromEntries(attendance.map((a) => [a.staff_id, a.daily_rate_minor])) })
  return { sales: sales.data, suggestions }
}

function sheetLines(sheetPlan, suggestions, overrides, { useWrongAccount = false } = {}) {
  const expenses = sheetPlan.expenseLines.map((l) => ({ kind: 'expense', account_id: useWrongAccount && l.wrong_account_id ? l.wrong_account_id : l.account_id, description: l.description, amount_minor: l.amount_minor }))
  const salaries = suggestions.map((s) => {
    const o = overrides[s.staff_id]
    const override = o && (!o.onlyIfBelow || s.suggested_minor < o.amount_minor)
    return { kind: 'salary', staff_id: s.staff_id, suggested_minor: s.suggested_minor, amount_minor: override ? o.amount_minor : s.suggested_minor, reason: override ? o.reason : '' }
  })
  return [...expenses, ...salaries, ...sheetPlan.caLines.map((l) => ({ ...l }))]
}

async function rpc(client, name, payload) {
  const { data, error } = await client.rpc(name, { payload })
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}

async function runSheets(plan, clients) {
  const tally = {}
  for (const sp of plan.sheets) {
    const ba = clients[`ba_${sp.branch}`]
    const reviewer = clients[sp.reviewer]
    if (RESUME) {
      const existing = must(await admin.from('daily_sheets').select('id, status').eq('branch', sp.branch).eq('business_date', sp.date).maybeSingle(), 'existing sheet')
      if (existing && existing.status !== 'draft') {
        tally.skipped = (tally.skipped || 0) + 1
        continue
      }
    }
    const { sales, suggestions } = await dayContext(sp.branch, sp.date)
    const save = async (lines, notes) => {
      const base = computeSheetTotals({ sales, lines, openingFloatMinor: 0 })
      // Salaries are paid in cash but ~45% of sales are GCash/card — the BA starts heavy days with a bigger float.
      const float = Math.max(sp.openingFloatMinor, Math.ceil((50000 - base.expectedCashMinor - sp.overShortMinor) / 100000) * 100000)
      const counted = base.expectedCashMinor + float + sp.overShortMinor
      const full = computeSheetTotals({ sales, lines, openingFloatMinor: float, countedCashMinor: counted })
      const res = await rpc(ba, 'save_daily_sheet', { branch: sp.branch, business_date: sp.date, opening_float_minor: float, counted_cash_minor: counted, notes, totals: full, lines: toSheetPayloadLines(lines) })
      await rpc(ba, 'submit_daily_sheet', { id: res.id })
      return res.id
    }
    const lines = sheetLines(sp, suggestions, plan.salaryOverrides, { useWrongAccount: sp.outcome === 'reopen_then_approve' })
    const id = await save(lines, sp.notes)
    if (sp.outcome === 'approve') await rpc(reviewer, 'review_daily_sheet', { id, action: 'approve' })
    if (sp.outcome === 'returned') await rpc(reviewer, 'review_daily_sheet', { id, action: 'return', review_note: sp.returnNote })
    if (sp.outcome === 'return_then_approve') {
      await rpc(reviewer, 'review_daily_sheet', { id, action: 'return', review_note: sp.returnNote })
      await save(lines, [sp.notes, 'Fixed as asked and resubmitted'].filter(Boolean).join(' · '))
      await rpc(reviewer, 'review_daily_sheet', { id, action: 'approve' })
    }
    if (sp.outcome === 'reopen_then_approve') {
      await rpc(clients.sa, 'review_daily_sheet', { id, action: 'approve' })
      await rpc(clients.sa, 'reopen_daily_sheet', { id, review_note: sp.reopenNote })
      await save(sheetLines(sp, suggestions, plan.salaryOverrides), sp.notes)
      await rpc(clients.sa, 'review_daily_sheet', { id, action: 'approve' })
    }
    tally[sp.outcome] = (tally[sp.outcome] || 0) + 1
  }
  console.log('  ✔ daily sheets:', JSON.stringify(tally))
}

const catalog = await loadCatalog()
const batangas = await ensureBatangasStaff()
const staff = await loadStaff(batangas)
const plan = buildSeptemberPlan({ catalog, staff })
console.log(APPLY ? 'APPLY — writing to' : 'DRY RUN — nothing written. Target:', new URL(url).host)
console.log(JSON.stringify(plan.expected, null, 2))
console.log(`queue events ${plan.queueEvents.length} · assignments ${plan.assignments.length} · sale lines ${plan.saleLines.length} · attendance ${plan.attendance.length} · bills ${plan.bills.length}`)
if (!RESUME) await preflight()
if (APPLY) {
  if (!RESUME) await insertPlan(plan)
  const clients = {
    ba_bacoor: await login(ACCOUNTS.ba),
    ba_batangas: await login([BATANGAS_SEED_STAFF[0].email, SEED_PASSWORD]),
    sa: await login(ACCOUNTS.sa),
    asa: await login(ACCOUNTS.asa),
  }
  await runSheets(plan, clients)
  console.log('✔ September 2026 seed applied. Verify: node scripts/verify-september-2026.mjs')
}
