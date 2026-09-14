/**
 * Payroll deep-audit leftovers: merch out of wash base, clamp %, theoretical pool, pesos, copy/ACL.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  clampCompensationPercent,
  isWashEligibleLine,
  normalizeCompensationSettings,
  washPoolAmountMinor,
} from '../src/lib/compensation.js'
import {
  buildPayrollPreview,
  minorFromPesos,
  pesosFromMinor,
  rebuildWashPoolLines,
} from '../src/lib/payroll.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const ty = { id: 'staff-ty', full_name: 'Ty', role: 'staff', branch_slug: 'bacoor' }

describe('wash-eligible lines', () => {
  it('excludes merch / product / coffee from the wash base', () => {
    assert.equal(isWashEligibleLine({ catalog_kind: 'product', line_total_minor: 50000 }), false)
    assert.equal(isWashEligibleLine({ item_type: 'merch', line_total_minor: 50000 }), false)
    assert.equal(isWashEligibleLine({ services: null, line_total_minor: 50000 }), false)
    assert.equal(isWashEligibleLine({ pay_category: 'coffee', line_total_minor: 12000 }), false)
    assert.equal(isWashEligibleLine({ services: { pay_category: 'wash' }, line_total_minor: 35000 }), true)
  })

  it('keeps wash lines and drops merch on a mixed ticket', () => {
    const sale = {
      total_minor: 150000,
      sale_line_items: [
        { line_total_minor: 100000, services: { pay_category: 'wash' } },
        { line_total_minor: 50000, services: null },
      ],
    }
    assert.equal(washPoolAmountMinor(sale), 100000)
  })

  it('still uses header total when the sale has no line items', () => {
    assert.equal(washPoolAmountMinor({ total_minor: 100000 }), 100000)
  })

  it('does not fall back to header total when the line embed is an empty array', () => {
    assert.equal(washPoolAmountMinor({ total_minor: 150000, sale_line_items: [] }), 0)
  })
})

describe('compensation percent clamp', () => {
  it('clamps owner percents to 0–100', () => {
    assert.equal(clampCompensationPercent(150), 100)
    assert.equal(clampCompensationPercent(-3), 0)
    assert.equal(clampCompensationPercent(35), 35)
  })

  it('normalizes stored wash_pool_pct over 100', () => {
    assert.equal(normalizeCompensationSettings({ wash_pool_pct: 150 }).wash_pool_pct, 100)
  })
})

describe('theoretical wash pool vs allocated', () => {
  it('shows theoretical pool when sales exist but nobody clocked in', () => {
    const preview = buildPayrollPreview({
      period: { start: '2026-08-08', end: '2026-08-08' },
      rules: { wash_pool_pct: 35 },
      sales: [
        {
          id: 'sale-wash',
          branch: 'bacoor',
          status: 'paid',
          total_minor: 285000,
          occurred_at: '2026-08-08T10:00:00+08:00',
          sale_line_items: [{ line_total_minor: 285000, services: { pay_category: 'wash' } }],
        },
      ],
      attendance: [],
    })
    assert.equal(preview.pos_sales_minor, 285000)
    assert.equal(preview.theoretical_pool_minor, 99750)
    assert.equal(preview.pool_minor, 0)
    assert.equal(preview.lines.length, 0)
  })

  it('adds catalog salary_pct into theoretical pool', () => {
    const preview = buildPayrollPreview({
      period: { start: '2026-08-19', end: '2026-08-19' },
      rules: { wash_pool_pct: 35 },
      sales: [
        {
          id: 'sale-mix',
          branch: 'bacoor',
          status: 'paid',
          total_minor: 150000,
          occurred_at: '2026-08-19T10:00:00+08:00',
          sale_line_items: [
            { line_total_minor: 100000, services: { pay_category: 'wash' } },
            { line_total_minor: 50000, services: { pay_category: 'wash', salary_pct: 20 } },
          ],
        },
      ],
      attendance: [],
    })
    assert.equal(preview.pos_sales_minor, 100000)
    assert.equal(preview.theoretical_pool_minor, 45000)
    assert.equal(preview.pool_minor, 0)
  })

  it('clamps rebuildWashPoolLines percent to 100', () => {
    const preview = buildPayrollPreview({
      period: { start: '2026-08-19', end: '2026-08-19' },
      rules: { wash_pool_pct: 35 },
      sales: [
        {
          id: 'sale-wash',
          branch: 'bacoor',
          status: 'paid',
          total_minor: 100000,
          occurred_at: '2026-08-19T10:00:00+08:00',
        },
      ],
      attendance: [{ ...ty, attendance_date: '2026-08-19', status: 'present' }],
    })
    const rebuilt = rebuildWashPoolLines(preview, 150)
    assert.equal(rebuilt.rules.wash_pool_pct, 100)
    assert.equal(rebuilt.theoretical_pool_minor, 100000)
    assert.equal(rebuilt.lines[0].pay_minor, 100000)
  })
})

describe('peso helpers', () => {
  it('converts shirt-sized ceramic deduction without a centavo lie', () => {
    assert.equal(pesosFromMinor(50000), 500)
    assert.equal(minorFromPesos('500'), 50000)
    assert.equal(minorFromPesos('500.00'), 50000)
  })
})

describe('payroll leftover copy + ACL (source)', () => {
  it('PayrollPage is honest about paid unclaimed tickets, pesos, and a closed guide', () => {
    const page = read('src/pages/PayrollPage.jsx')
    assert.doesNotMatch(page, /unpaid POS/)
    assert.match(page, /theoretical_pool_minor/)
    assert.match(page, /none allocated/)
    assert.match(page, /defaultOpen=\{false\}/)
    assert.match(page, /Payroll confirmed/)
    assert.match(page, /label: 'Advances'/)
    assert.match(page, /validatePayrollCustomRange\(periodStart, periodEnd\)/)
    assert.match(page, /htmlFor="payroll-adj-staff"/)
    assert.match(page, /htmlFor="payroll-adj-amount"/)
    assert.match(page, /pesosFromMinor\(rules\.ceramic_shirt_deduction_minor\)/)
  })

  it('Settings payroll writes require canRunPayroll, not any admin', () => {
    const page = read('src/pages/settings/PayrollSettingsPage.jsx')
    assert.match(page, /canRunPayroll/)
    assert.doesNotMatch(page, /isAdmin/)
    assert.match(page, /ASA with finance write/)
  })

  it('Inventory salary % no longer claims preview-only', () => {
    const page = read('src/pages/ServicesManagePage.jsx')
    assert.doesNotMatch(page, /does not auto-pay/)
    assert.match(page, /Paid on the next floor payroll run/)
  })
})
