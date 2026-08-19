import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROLES, getBranchScopeList } from '../src/auth/permissions.js'
import { branchScopeList, scopeBranch, rollupRetentionByCustomer } from '../src/lib/financeData.js'
import {
  buildCompensationPostPlan,
  washPoolAmountMinor,
  detailingAmountMinor,
  effectiveCeramicToggles,
  buildCeramicCompensationExpenses,
} from '../src/lib/compensation.js'
import { classifySaleBucket } from '../src/lib/bacoorDailyReport.js'
import { paidSalesToBacoorRows } from '../src/lib/posSellables.js'
import { isInsideGeofence, canClockAttendance, shouldEnforceGeofence } from '../src/lib/attendanceGeo.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('ops money + attendance seam (live role strings)', () => {
  it('BossMich finance scope is all branches, not a fake super_admin role', () => {
    assert.equal(branchScopeList({ role: ROLES.SUPER_ADMIN, branch_slug: 'bacoor' }), null)
    assert.equal(getBranchScopeList({ role: ROLES.SUPER_ADMIN }), null)
    assert.notEqual(ROLES.SUPER_ADMIN, 'super_admin')
  })

  it('ASA all-sites uses permission_grants.branches_all, not a grants array', () => {
    assert.equal(
      branchScopeList({
        role: ROLES.ASSISTANT_SUPER_ADMIN,
        permission_grants: { branches_all: true },
        branch_slug: 'imus',
      }),
      null,
    )
    assert.deepEqual(
      branchScopeList({
        role: ROLES.ASSISTANT_SUPER_ADMIN,
        permission_grants: { branches_all: false },
        branch_slugs: ['bacoor'],
      }),
      ['bacoor'],
    )
  })

  it('missing profile fails closed so Finance cannot leak all sites', () => {
    const q = { eq(col, val) { this.col = col; this.val = val; return this } }
    scopeBranch(q, null, 'all')
    assert.equal(q.col, 'branch')
    assert.equal(q.val, '__none__')
  })

  it('wash pool ignores detailing sales and keeps wash lines', () => {
    assert.equal(
      washPoolAmountMinor({
        total_minor: 200000,
        sale_line_items: [
          { line_total_minor: 150000, services: { pay_category: 'wash' } },
          { line_total_minor: 50000, services: { pay_category: 'detailing' } },
        ],
      }),
      150000,
    )
    assert.equal(
      washPoolAmountMinor({ total_minor: 80000, pay_category: 'detailing' }),
      0,
    )
    const plan = buildCompensationPostPlan({
      date: '2026-08-19',
      poolPct: 35,
      salesRows: [
        { branch: 'bacoor', total_minor: 100000, pay_category: 'wash' },
        { branch: 'bacoor', total_minor: 100000, pay_category: 'detailing' },
      ],
      roster: [{ id: 's1', full_name: 'Ana', branch_slug: 'bacoor', attendance_status: 'present' }],
    })
    assert.equal(plan.totalSales, 100000)
    assert.equal(plan.pool_minor, 35000)
  })

  it('daily close buckets detailing bookings as coating, not queue wash', () => {
    assert.equal(classifySaleBucket({ booking_id: 'b1', pay_category: 'detailing', total_minor: 1 }), 'coating')
    assert.equal(classifySaleBucket({ pos_handoff_id: 'h1', pay_category: 'wash', total_minor: 1 }), 'carwash')
    assert.equal(classifySaleBucket({ name: 'Iced coffee', item_type: 'product', total_minor: 1 }), 'refreshment')
    const closeRows = paidSalesToBacoorRows([
      {
        status: 'paid',
        total_minor: 90000,
        payment_method: 'cash',
        booking_id: 'd1',
        pay_category: 'detailing',
      },
    ])
    assert.equal(closeRows[0].bucket, 'coating')
  })

  it('geofence helper always returns ok/distance; People toggles reach the clock', () => {
    const miss = isInsideGeofence({ userLat: 'x', userLng: 1, branchLat: 1, branchLng: 1, radiusM: 20 })
    assert.equal(miss.ok, false)
    assert.equal(typeof miss.distanceM, 'number')
    assert.equal(shouldEnforceGeofence({ geofence_enabled: false }), false)
    assert.equal(shouldEnforceGeofence({ geofence_enabled: true }), true)
    assert.equal(canClockAttendance({ attendance_enabled: false }), false)
    assert.equal(canClockAttendance({ attendance_enabled: true }), true)
  })

  it('clock uses selected branch and geofence toggle; reports ops queries take branch scope', () => {
    const api = readFileSync(join(root, 'src/queue/attendanceApi.js'), 'utf8')
    const geo = readFileSync(join(root, 'src/lib/attendanceGeo.js'), 'utf8')
    const panel = readFileSync(join(root, 'src/pages/crew/CrewAttendancePanels.jsx'), 'utf8')
    const reports = readFileSync(join(root, 'src/pages/finance/FinanceReportsTab.jsx'), 'utf8')
    const payUi = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    assert.match(api, /shouldEnforceGeofence/)
    assert.match(api, /canClockAttendance/)
    assert.match(api, /branchSlug/)
    assert.match(geo, /export function canClockAttendance/)
    assert.match(geo, /export function shouldEnforceGeofence/)
    assert.match(panel, /geoTimeIn\(\{ profile, coords, branchSlug \}\)/)
    assert.match(reports, /scopeBranch/)
    assert.match(payUi, /myPayRows|own pay|Your pay/i)
  })

  it('POS ceramic toggles post crew/detailer drafts from known 20k coating ticket', () => {
    const cart = [
      { pay_category: 'detailing', quantity: 1, unit_price_minor: 2000000 },
      { pay_category: 'wash', quantity: 1, unit_price_minor: 50000 },
    ]
    assert.equal(detailingAmountMinor(cart), 2000000)
    const cardOn = effectiveCeramicToggles({ freeShirt: false, cardPayment: false }, 'card')
    assert.equal(cardOn.cardPayment, true)
    const drafts = buildCeramicCompensationExpenses({
      saleId: 'sale-1',
      date: '2026-08-19',
      branch: 'bacoor',
      salesMinor: 2000000,
      toggles: { freeShirt: true, cardPayment: false, crewAssisted: true, detailerAssigned: true },
    })
    // 20_000 pesos − 500 shirt = 19_500; 10% crew + 10% detailer
    assert.equal(drafts.find((r) => r.expense_kind === 'salary_carwash')?.total_minor, 195000)
    assert.equal(drafts.find((r) => r.expense_kind === 'salary_detailer')?.total_minor, 195000)
    assert.equal(drafts.find((r) => r.expense_kind === 'salary_carwash')?.description, 'ceramic:sale-1:crew')
    assert.equal(drafts.find((r) => r.expense_kind === 'salary_detailer')?.description, 'ceramic:sale-1:detailer')
    assert.equal(buildCeramicCompensationExpenses({ saleId: 'x', branch: 'bacoor', salesMinor: 0 }).length, 0)
  })

  it('retention rollup merges the same customer across branches; POS and reports wire ceramic + branch', () => {
    const rolled = rollupRetentionByCustomer([
      { customer_id: 'c1', full_name: 'Ada', branch: 'bacoor', paid_sales: 2, total_spent_minor: 100, first_paid_at: '2026-01-01', last_paid_at: '2026-02-01' },
      { customer_id: 'c1', full_name: 'Ada', branch: 'imus', paid_sales: 3, total_spent_minor: 250, first_paid_at: '2025-12-01', last_paid_at: '2026-03-01' },
    ])
    assert.equal(rolled.length, 1)
    assert.equal(rolled[0].paid_sales, 5)
    assert.equal(rolled[0].total_spent_minor, 350)
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    const reports = readFileSync(join(root, 'src/pages/finance/FinanceReportsTab.jsx'), 'utf8')
    const mig = readFileSync(join(root, 'supabase/migrations/20260819074635_finance_retention_branch.sql'), 'utf8')
    assert.match(pos, /buildCeramicCompensationExpenses/)
    assert.match(reports, /finance_customer_retention/)
    assert.match(reports, /scopeBranch/)
    assert.match(mig, /s\.branch/)
    assert.match(mig, /sales_paid_branch_customer_idx/)
  })
})
