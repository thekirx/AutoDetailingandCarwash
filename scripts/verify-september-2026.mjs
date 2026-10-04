/**
 * Accuracy check for the September 2026 seed (read-only). Compares the database against:
 *  1. the deterministic plan (counts per status),
 *  2. the app's own formulas (computeSheetTotals / floorMoneyBreakdown) vs the server-stored sheet totals,
 *  3. independent sums of sales + expenses vs the finance_daily_pl view (P&L / Floor Board source),
 *  4. the approval trail (posted expenses + audit logs) for every approve / return / reopen path.
 * node scripts/verify-september-2026.mjs   → exit 1 on any mismatch
 */
import { buildSeptemberPlan, SEED_TAG, SEED_BRANCHES, SEPTEMBER_DAYS } from './seed/september2026Plan.mjs'
import { SALE_SELECT, admin, findBatangasStaff, loadCatalog, loadStaff, must, pageAll } from './seed/september2026Db.mjs'
import { computeSheetTotals, floorMoneyBreakdown } from '../src/lib/dailySheet.js'
import { maintenanceUrgency } from '../src/lib/paintMaintenance.js'

const START = `${SEPTEMBER_DAYS[0]}T00:00:00+08:00`
const END = `${SEPTEMBER_DAYS.at(-1)}T23:59:59.999+08:00`
const manilaDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
let failures = 0
const check = (ok, name, detail = '') => {
  if (!ok) failures += 1
  console.log(ok ? '✔' : '✖', name, detail)
}
const peso = (minor) => `₱${(minor / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

const plan = buildSeptemberPlan({ catalog: await loadCatalog(), staff: await loadStaff(await findBatangasStaff()) })
const exp = plan.expected

// ── 1. Rows vs plan ─────────────────────────────────────────────────────────
const bookings = await pageAll(() => admin.from('bookings').select('id, status, redo_at, queue_date, queue_number, vehicle_id, final_checked_by, sent_to_payment_by').like('notes', `${SEED_TAG}%`).order('id'))
const byStatus = (rows, key = 'status') => rows.reduce((m, r) => ({ ...m, [r[key]]: (m[r[key]] || 0) + 1 }), {})
const bStatus = byStatus(bookings)
check(bookings.length === exp.bookings, 'bookings inserted', `${bookings.length}/${exp.bookings}`)
check(bStatus.completed === exp.completedCars && bStatus.cancelled === exp.cancelled && bStatus.no_show === exp.noShow, 'booking statuses', JSON.stringify(bStatus))
check(bookings.filter((b) => b.redo_at).length === exp.redo, 'failed-QA redos', `${bookings.filter((b) => b.redo_at).length}`)
check(bookings.every((b) => b.queue_date >= SEPTEMBER_DAYS[0] && b.queue_date <= SEPTEMBER_DAYS.at(-1)), 'every queue_date is in September (none on today\'s live queue)')
check(bookings.every((b) => b.queue_number > 0 && b.vehicle_id), 'queue numbers + vehicle masterlist links assigned')
check(bookings.filter((b) => b.status === 'completed').every((b) => b.final_checked_by && b.sent_to_payment_by), 'completed cars carry TL final-check + send-to-payment stamps')
const bookingIds = bookings.map((b) => b.id)
const countIn = async (table, col = 'booking_id') => {
  let n = 0
  for (let i = 0; i < bookingIds.length; i += 300) {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).in(col, bookingIds.slice(i, i + 300))
    if (error) throw new Error(`${table}: ${error.message}`)
    n += count
  }
  return n
}
check((await countIn('queue_events')) === plan.queueEvents.length, 'queue events (status history)', `${plan.queueEvents.length}`)
check((await countIn('queue_assignments')) === plan.assignments.length, 'crew assignments', `${plan.assignments.length}`)
check((await countIn('sms_events')) === 0, 'no SMS queued for seed bookings')

const seedSales = await pageAll(() => admin.from('sales').select('id, status').like('notes', `${SEED_TAG}%`).order('id'))
const sStatus = byStatus(seedSales)
check(sStatus.paid === exp.sales.paid && sStatus.refunded === exp.sales.refunded && sStatus.voided === exp.sales.voided, 'sale statuses', JSON.stringify(sStatus))
const maint = must(await admin.from('vehicle_maintenance_schedules').select('status, next_due_at, vehicle_id, last_maintenance_at').like('notes', `${SEED_TAG}%`), 'maintenance')
check(maint.length === exp.maintenance && maint.every((m) => m.vehicle_id), 'maintenance schedules linked to vehicles', `${maint.length}`)
const urgency = byStatus(maint.filter((m) => m.status !== 'cancelled').map((m) => ({ u: maintenanceUrgency(m.next_due_at, '2026-10-04') })), 'u')
check(urgency.overdue >= 5, 'maintenance tab has overdue plates on 2026-10-04', JSON.stringify({ ...urgency, notified: maint.filter((m) => m.status === 'notified').length, reset: maint.filter((m) => m.last_maintenance_at).length }))

// ── 2. Daily sheets: server totals vs app formula, approvals, posted expenses, audit ──
const sales = await pageAll(() => admin.from('sales').select(SALE_SELECT).in('branch', SEED_BRANCHES).in('status', ['paid', 'refunded']).gte('occurred_at', START).lte('occurred_at', END).order('occurred_at').order('id'))
const salesOf = new Map()
for (const s of sales) {
  const key = `${s.branch}|${manilaDay(s.occurred_at)}`
  salesOf.set(key, [...(salesOf.get(key) || []), s])
}
const sheets = must(await admin.from('daily_sheets').select('id, branch, business_date, status, opening_float_minor, counted_cash_minor, notes, totals, review_note, daily_sheet_lines(id, kind, amount_minor, account_id, description)').in('branch', SEED_BRANCHES).gte('business_date', SEPTEMBER_DAYS[0]).lte('business_date', SEPTEMBER_DAYS.at(-1)), 'sheets')
check(sheets.length === 60, 'one daily sheet per branch-day', `${sheets.length}/60`)
const FINAL = { approve: 'approved', return_then_approve: 'approved', reopen_then_approve: 'approved', returned: 'returned', submitted: 'submitted' }
const AUDIT = {
  approve: { submit: 1, approve: 1 },
  return_then_approve: { submit: 2, return: 1, approve: 1 },
  reopen_then_approve: { submit: 2, approve: 2, reopen: 1 },
  returned: { submit: 1, return: 1 },
  submitted: { submit: 1 },
}
const sheetIds = sheets.map((s) => s.id)
const audit = must(await admin.from('audit_logs').select('entity_id, action, actor_role').eq('entity_type', 'daily_sheets').in('entity_id', sheetIds), 'audit')
const lineIds = sheets.flatMap((s) => s.daily_sheet_lines.map((l) => l.id))
const posted = []
for (let i = 0; i < lineIds.length; i += 300) posted.push(...must(await admin.from('expenses').select('daily_sheet_line_id, total_minor, status, created_at, category_id').in('daily_sheet_line_id', lineIds.slice(i, i + 300)), 'posted'))
const FIELDS = ['grossMinor', 'discountsMinor', 'refundsMinor', 'netMinor', 'count', 'cashMinor', 'expensesMinor', 'salariesMinor', 'expectedCashMinor', 'overShortMinor']
let totalsOk = 0
let statusOk = 0
let postedOk = 0
let auditOk = 0
const asaReviewed = new Set(audit.filter((a) => a.actor_role === 'assistant_super_admin').map((a) => a.entity_id))
for (const sp of plan.sheets) {
  const row = sheets.find((s) => s.branch === sp.branch && s.business_date === sp.date)
  if (!row) {
    check(false, `sheet ${sp.branch} ${sp.date} missing`)
    continue
  }
  const app = computeSheetTotals({ sales: salesOf.get(`${sp.branch}|${sp.date}`) || [], lines: row.daily_sheet_lines, openingFloatMinor: row.opening_float_minor, countedCashMinor: row.counted_cash_minor })
  const diff = FIELDS.filter((f) => Number(row.totals?.[f]) !== Number(app[f]))
  if (diff.length) check(false, `sheet ${sp.branch} ${sp.date} server vs app totals`, diff.map((f) => `${f}: server ${row.totals?.[f]} app ${app[f]}`).join('; '))
  else totalsOk += 1
  if (row.status === FINAL[sp.outcome] && app.overShortMinor === sp.overShortMinor && (!sp.overShortMinor || row.notes)) statusOk += 1
  else check(false, `sheet ${sp.branch} ${sp.date} status/drawer`, `${row.status} vs ${FINAL[sp.outcome]}, over/short ${app.overShortMinor} vs ${sp.overShortMinor}`)
  const mine = posted.filter((p) => row.daily_sheet_lines.some((l) => l.id === p.daily_sheet_line_id))
  const want = row.status === 'approved' ? row.daily_sheet_lines.filter((l) => ['expense', 'salary'].includes(l.kind) && l.amount_minor > 0) : []
  const sum = mine.reduce((t, p) => t + p.total_minor, 0)
  const wantSum = want.reduce((t, l) => t + l.amount_minor, 0)
  if (mine.length === want.length && sum === wantSum && mine.every((p) => p.status === 'paid' && manilaDay(p.created_at) === sp.date)) postedOk += 1
  else check(false, `sheet ${sp.branch} ${sp.date} posted expenses`, `${mine.length}/${want.length} lines, ${sum} vs ${wantSum}`)
  const acts = byStatus(audit.filter((a) => a.entity_id === row.id).map((a) => ({ a: a.action.replace('daily_sheet.', '') })), 'a')
  if (JSON.stringify(Object.entries(acts).sort()) === JSON.stringify(Object.entries(AUDIT[sp.outcome]).sort())) auditOk += 1
  else check(false, `sheet ${sp.branch} ${sp.date} audit trail`, `${JSON.stringify(acts)} vs ${JSON.stringify(AUDIT[sp.outcome])}`)
}
check(totalsOk === 60, 'server-stored sheet totals = app computeSheetTotals (10 fields × 60 sheets)', `${totalsOk}/60`)
check(statusOk === 60, 'final sheet statuses + drawer over/short with notes', `${statusOk}/60`)
check(postedOk === 60, 'approved sheets posted each expense/salary line once (paid, dated business day); others posted none', `${postedOk}/60`)
check(auditOk === 60, 'audit trail matches each path (submit / return / approve / reopen)', `${auditOk}/60`)
check(asaReviewed.size > 0 && plan.sheets.filter((s) => s.reviewer === 'asa').length > 0, 'ASA reviewed sheets (not only SA)', `${asaReviewed.size} sheets`)
const reopened = sheets.find((s) => s.branch === 'bacoor' && s.business_date === '2026-09-12')
const chem = reopened.daily_sheet_lines.find((l) => /shampoo|tire|microfiber/i.test(l.description || ''))
const chemPosted = posted.find((p) => p.daily_sheet_line_id === chem?.id)
check(chemPosted?.category_id === plan.sheets.find((s) => s.date === '2026-09-12' && s.branch === 'bacoor').expenseLines.find((l) => l.wrong_account_id).account_id, 'reopened sheet re-posted the corrected account (Chemicals, not Meals)')

// ── 3. P&L view vs independent sums ─────────────────────────────────────────
const pl = await pageAll(() => admin.from('finance_daily_pl').select('branch, period_date, kind, amount_minor').in('branch', SEED_BRANCHES).gte('period_date', SEPTEMBER_DAYS[0]).lte('period_date', SEPTEMBER_DAYS.at(-1)).order('period_date'))
const expenses = await pageAll(() => admin.from('expenses').select('branch, total_minor, created_at').in('branch', SEED_BRANCHES).in('status', ['paid', 'posted']).gte('created_at', START).lte('created_at', END).order('id'))
let plOk = 0
for (const branch of SEED_BRANCHES) {
  for (const day of SEPTEMBER_DAYS) {
    const income = sales.filter((s) => s.status === 'paid' && s.branch === branch && manilaDay(s.occurred_at) === day).reduce((t, s) => t + s.total_minor, 0)
    const spent = expenses.filter((e) => e.branch === branch && manilaDay(e.created_at) === day).reduce((t, e) => t + e.total_minor, 0)
    const v = (kind) => pl.filter((r) => r.branch === branch && r.period_date === day && r.kind === kind).reduce((t, r) => t + Number(r.amount_minor), 0)
    if (v('income') === income && v('expense') === spent) plOk += 1
    else check(false, `P&L ${branch} ${day}`, `income ${v('income')} vs ${income}, expense ${v('expense')} vs ${spent}`)
  }
}
check(plOk === 60, 'finance_daily_pl income/expense = independent sums per branch-day', `${plOk}/60`)

// ── 4. Floor Board (custom range Sep 1–30) ──────────────────────────────────
const board = floorMoneyBreakdown({ sales, plRows: pl })
const net = sales.filter((s) => s.status === 'paid').reduce((t, s) => t + s.total_minor, 0)
check(board.totals.netMinor === net, 'Floor Board net sales = sum of paid sales', peso(net))
for (const branch of SEED_BRANCHES) {
  const row = board.byBranch.find((r) => r.branch === branch)
  const income = pl.filter((r) => r.branch === branch && r.kind === 'income').reduce((t, r) => t + Number(r.amount_minor), 0)
  const spent = pl.filter((r) => r.branch === branch && r.kind === 'expense').reduce((t, r) => t + Number(r.amount_minor), 0)
  check(row && row.netProfitMinor === income - spent && row.netMinor === income, `Floor Board ${branch}: net ${peso(row?.netMinor || 0)} · expenses ${peso(spent)} · net profit ${peso(row?.netProfitMinor || 0)}`)
}

console.log(failures ? `\n✖ ${failures} check(s) failed` : '\n✔ September 2026 data is consistent across queue, POS, daily sheets, P&L and Floor Board')
process.exit(failures ? 1 : 0)
