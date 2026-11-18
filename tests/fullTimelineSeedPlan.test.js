import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FULL_TIMELINE_TAG,
  FULL_TIMELINE_MONTHS,
  ALL_SYSTEM_ROLES,
  buildFullTimelinePlan,
} from '../scripts/seed/fullTimelinePlan.mjs'
import { buildSyntheticCatalogAndStaff } from '../scripts/seed-full-timeline.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('June 2025 – November 2026 full-timeline seed plan & multi-month scale contracts', () => {
  const { catalog, staff } = buildSyntheticCatalogAndStaff()
  const plan = buildFullTimelinePlan({
    catalog,
    staff,
    months: FULL_TIMELINE_MONTHS,
    skipOpsMonths: ['2026-09'],
    daysPerMonth: 6,
    maxDate: '2026-11-18',
  })

  it('covers all 18 months (June 2025 – November 2026) and all 12 system roles', () => {
    assert.equal(FULL_TIMELINE_MONTHS.length, 18)
    assert.equal(FULL_TIMELINE_MONTHS[0], '2025-06')
    assert.equal(FULL_TIMELINE_MONTHS[17], '2026-11')
    assert.equal(ALL_SYSTEM_ROLES.length, 12)
    assert.equal(plan.expected.monthsCovered, 18)
    assert.equal(plan.expected.opsMonthsSeeded, 17)
    assert.ok(plan.customers.length > 500)
    assert.equal(plan.customers.length, plan.vehicles.length)
    assert.ok(plan.customerMemberships.length > 100)
    assert.ok(plan.loyaltyLedger.length > 500)
    assert.ok(plan.bookings.length > 1500)
    assert.ok(plan.attendance.length > 1000)
    assert.ok(plan.sales.length > 1500)
    assert.ok(plan.expected.sales.paid > 1500)
    assert.ok(plan.expected.sales.refunded > 0)
    assert.ok(plan.expected.sales.voided > 0)
    assert.ok(plan.dailySheets.length >= 190)
    assert.ok(plan.dailySheetLines.length >= 600)
    assert.ok(plan.dailySheetExpenses.length >= 500)
    assert.ok(plan.bills.length >= 100)
    assert.ok(plan.payslips.length >= 200)
    assert.ok(plan.payrollLocks.length >= 60)
    assert.ok(plan.planCards.length >= 70)
    assert.ok(plan.contactInquiries.length >= 34)
    assert.ok(plan.serviceReviews.length >= 50)
    assert.ok(plan.restockRequests.length >= 34)
    assert.ok(plan.inventoryRecons.length >= 34)
    assert.ok(plan.notificationBroadcasts.length >= 17)
  })

  it('enforces 100% SMS safety and tag isolation across all seeded rows', () => {
    for (const c of plan.customers) {
      assert.equal(c.notify_sms, false, `customer ${c.id} must have notify_sms=false`)
      assert.match(c.email, /@seed\.hakumautocare\.local$/)
    }
    for (const b of plan.bookings) {
      assert.ok(
        ['completed', 'cancelled', 'no_show', 'confirmed'].includes(b.status),
        `booking ${b.id} must be in a terminal/non-queue-trigger status, got ${b.status}`,
      )
      assert.match(b.notes, new RegExp(FULL_TIMELINE_TAG.replace(/[[\]]/g, '\\$&')))
    }
  })

  it('reconciles every POS sale against its sale_line_items, every daily sheet total, and every payslip expense', () => {
    const linesBySale = new Map()
    for (const l of plan.saleLines) {
      assert.equal(l.line_total_minor, l.unit_price_minor * l.quantity)
      assert.ok(['service', 'package', 'detailing', 'ppf', 'merch'].includes(l.line_kind))
      linesBySale.set(l.sale_id, (linesBySale.get(l.sale_id) || 0) + l.line_total_minor)
    }
    for (const s of plan.sales) {
      const sumLines = linesBySale.get(s.id) || 0
      assert.equal(s.subtotal_minor, sumLines, `sale ${s.id} subtotal must equal line items sum`)
      assert.equal(s.total_minor, s.subtotal_minor - s.discount_minor, `sale ${s.id} total must equal subtotal - discount`)
    }

    const expByLine = new Map(plan.dailySheetExpenses.map((e) => [e.daily_sheet_line_id, e]))
    for (const s of plan.dailySheets) {
      assert.equal(typeof s.totals.netMinor, 'number')
      assert.equal(typeof s.totals.expensesMinor, 'number')
      assert.equal(typeof s.totals.salariesMinor, 'number')
      assert.equal(typeof s.totals.netProfitMinor, 'number')
    }
    for (const l of plan.dailySheetLines) {
      if ((l.kind === 'expense' || l.kind === 'salary') && l.amount_minor > 0) {
        const sheet = plan.dailySheets.find((s) => s.id === l.sheet_id)
        if (sheet?.status === 'approved') {
          const posted = expByLine.get(l.id)
          assert.ok(posted, `approved daily sheet line ${l.id} must have a posted expense row`)
          assert.equal(posted.total_minor, l.amount_minor)
          assert.ok(posted.description.startsWith(`daily_sheet:${sheet.id}:${l.id}`))
        }
      }
    }

    const expById = new Map(plan.payrollExpenses.map((e) => [e.payslip_id, e]))
    for (const slip of plan.payslips) {
      assert.match(slip.period_start, /^\d{4}-\d{2}-(01|16)$/)
      const exp = expById.get(slip.id)
      assert.ok(exp, `payslip ${slip.id} must have a matching salary_monthly expense`)
      assert.equal(exp.expense_kind, 'salary_monthly')
      assert.equal(exp.category_id, catalog.accounts[14])
      assert.equal(exp.total_minor, slip.salary_minor + slip.incentive_minor)
    }
  })

  it('guards multi-month queries with collectPaged and prevents invalid "all-MM-01" date syntax in MonthlyPayrollPage', () => {
    const payroll = read('src/pages/MonthlyPayrollPage.jsx')
    assert.match(payroll, /collectPaged/)
    assert.match(payroll, /if \(historyYear && historyYear !== 'all'\)/)
    assert.match(payroll, /String\(r\.period_start \|\| ''\)\.slice\(5, 7\) === mm/)

    const finance = read('src/pages/FinancePage.jsx')
    assert.match(finance, /fetchSalesSummaryRows/)
    assert.match(finance, /fetchPlRows/)
    assert.match(finance, /fetchKindRows/)

    const sheetApi = read('src/lib/dailySheetApi.js')
    assert.match(sheetApi, /if \(from \|\| to \|\| limit > 1000\)/)
    assert.match(sheetApi, /collectPaged/)

    const referralRank = read('src/components/bookings/ReferralRank.jsx')
    assert.match(referralRank, /collectPaged/)
    assert.doesNotMatch(referralRank, /\.limit\(1000\)/)

    const crm = read('src/pages/CrmPage.jsx')
    assert.doesNotMatch(crm, /from\('customer_memberships'\)[\s\S]{0,160}?\.limit\(1000\)/)

    const migration = read('supabase/migrations/20261118170000_multi_month_scale_indexes.sql')
    assert.match(migration, /payslips_staff_period_idx/)
    assert.match(migration, /payslips_period_start_idx/)
    assert.match(migration, /daily_sheets_business_date_desc_idx/)
    assert.match(migration, /customer_memberships_active_customer_idx/)
  })
})
