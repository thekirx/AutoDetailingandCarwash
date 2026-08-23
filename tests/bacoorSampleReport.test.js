import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildBacoorDailyReport, formatBacoorReportText } from '../src/lib/bacoorDailyReport.js'
import {
  applyCaCollectedToCashLeft,
  moneySnapshotFromReport,
  projectShiftCloseMoney,
  shiftCloseValidationBaseline,
} from '../src/lib/shiftClose.js'

const pesos = (n) => Math.round(n * 100)
const plainMoney = (minor) => String(Math.round((Number(minor) || 0) / 100))

/** Owner sample — Bacoor Aug 22, 2026 (pesos). */
const SAMPLE = {
  totalSales: 21750,
  gcash: 5751,
  caCollected: 1000,
  totalExpenses: 9419,
  cashLeft: 7580,
  carWash: 19530,
  refreshment: 980,
  accessories: 1240,
  carwashSalary: 6835,
  approvedCaJaycee: 500,
  caRepayments: [
    { label: 'Darel', amount: 250 },
    { label: 'Roger', amount: 250 },
    { label: 'Ronel', amount: 250 },
    { label: 'Jorem', amount: 250 },
  ],
  daily: [
    { label: 'ice', amount: 40 },
    { label: 'mineral water', amount: 75 },
    { label: 'sir keeno', amount: 970 },
    { label: 'Wifi load', amount: 999 },
  ],
}

function buildSampleReport() {
  const sales = [
    { status: 'paid', payment_method: 'gcash', total_minor: pesos(SAMPLE.gcash), bucket: 'carwash' },
    {
      status: 'paid',
      payment_method: 'cash',
      total_minor: pesos(SAMPLE.carWash - SAMPLE.gcash),
      bucket: 'carwash',
    },
    { status: 'paid', payment_method: 'cash', total_minor: pesos(SAMPLE.refreshment), bucket: 'refreshment' },
    { status: 'paid', payment_method: 'cash', total_minor: pesos(SAMPLE.accessories), bucket: 'accessories' },
  ]

  const expenses = [
    {
      expense_kind: 'salary_carwash',
      amount_minor: pesos(SAMPLE.carwashSalary),
      label: 'Carwash Salary',
      status: 'draft',
    },
    ...SAMPLE.daily.map((row) => ({
      expense_kind: 'daily',
      amount_minor: pesos(row.amount),
      label: row.label,
      status: 'draft',
    })),
    ...SAMPLE.caRepayments.map((row) => ({
      expense_kind: 'ca_repayment',
      amount_minor: pesos(row.amount),
      label: row.label,
      status: 'draft',
    })),
  ]

  return buildBacoorDailyReport({
    branch: 'bacoor',
    branchSlug: 'bacoor',
    branchDisplay: 'Hakum Bacoor',
    date: '2026-08-22',
    sales,
    classifyBucket: (r) => r.bucket,
    expenses,
    cashAdvances: [
      {
        status: 'approved',
        amount_minor: pesos(SAMPLE.approvedCaJaycee),
        employee_name: 'Jaycee',
      },
    ],
  })
}

describe('Bacoor sample report Aug 22 2026', () => {
  it('matches owner totals when POS sales and expenses are entered correctly', () => {
    const report = buildSampleReport()

    assert.equal(report.total_sales_minor, pesos(SAMPLE.totalSales))
    assert.equal(report.total_gcash_minor, pesos(SAMPLE.gcash))
    assert.equal(report.car_wash_sales_minor, pesos(SAMPLE.carWash))
    assert.equal(report.total_expenses_minor, pesos(SAMPLE.totalExpenses))
    assert.equal(report.ca_collected_minor, pesos(SAMPLE.caCollected))
    assert.equal(report.total_cash_left_minor, pesos(SAMPLE.cashLeft))
    assert.equal(report.ca_repayments.length, 4)
    assert.equal(report.branch_slug, 'bacoor')

    const baseline = moneySnapshotFromReport(report)
    const submitted = applyCaCollectedToCashLeft(baseline, baseline)
    assert.equal(submitted.total_cash_left_minor, pesos(SAMPLE.cashLeft))

    const projected = projectShiftCloseMoney(report, {})
    assert.equal(projected.ca_collected_minor, pesos(SAMPLE.caCollected))
    assert.equal(projected.total_cash_left_minor, pesos(SAMPLE.cashLeft))

    const validationBase = shiftCloseValidationBaseline(report, projected)
    assert.equal(validationBase.total_cash_left_minor, pesos(SAMPLE.cashLeft))

    const text = formatBacoorReportText(report, plainMoney)
    assert.match(text, /BACOOR SALES REPORT/)
    assert.match(text, /Square Sales: 21750/)
    assert.match(text, /Total Cash Left: 7580/)
    assert.match(text, /Jaycee-500/)
    assert.match(text, /Darel-250/)
    assert.match(text, /Roger-250/)
    assert.doesNotMatch(text, /Cash Advance Payment[\s\S]*Jaycee-500/)
  })
})

describe('Bacoor multi-branch headers', () => {
  it('uses branch slug in report header for each site', () => {
    const imus = buildBacoorDailyReport({
      branch: 'imus',
      branchSlug: 'imus',
      branchDisplay: 'Hakum Imus',
      date: '2026-08-22',
      sales: [{ status: 'paid', payment_method: 'cash', total_minor: 10000, bucket: 'carwash' }],
      classifyBucket: (r) => r.bucket,
    })
    const text = formatBacoorReportText(imus, plainMoney)
    assert.match(text, /^IMUS SALES REPORT/)
  })
})
