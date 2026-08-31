/**
 * Phase 2 — POS / queue flow audit (ticket → paid sale).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifySaleBucket } from '../src/lib/bacoorDailyReport.js'
import {
  AUDIT_DAY,
  BACOOR,
  IMUS,
  buildCaRepaymentExpense,
  buildShopDaySales,
} from '../src/lib/auditFixtures.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sales = buildShopDaySales()

function paidTotal(rows) {
  return rows
    .filter((s) => String(s.status) === 'paid')
    .reduce((acc, s) => acc + (Number(s.total_minor) || 0), 0)
}

describe('POS flow audit', () => {
  it('1 wash ticket sale has amount, method, business date', () => {
    const wash = sales.find((s) => s.id === 'sale-bacoor-wash')
    assert.equal(wash.total_minor, 200_000)
    assert.equal(wash.payment_method, 'cash')
    assert.equal(String(wash.occurred_at).slice(0, 10), AUDIT_DAY)
    assert.equal(wash.pos_handoff_id, 'q-bacoor-1')
    assert.equal(classifySaleBucket(wash), 'carwash')
  })

  it('2 detailing booking preserves assigned detailer for commission', () => {
    const ceramic = sales.find((s) => s.id === 'sale-imus-ceramic')
    assert.equal(ceramic.assigned_staff_id, 'det-imus')
    assert.equal(ceramic.detailer_staff_id, 'det-imus')
    assert.equal(ceramic.booking_id, 'book-imus-1')
    assert.equal(classifySaleBucket(ceramic), 'coating')
  })

  it('3 walk-in POS detailing sets detailer_staff_id', () => {
    const walk = sales.find((s) => s.id === 'sale-bacoor-walkin-detail')
    assert.equal(walk.detailer_staff_id, 'det-bacoor')
    assert.equal(walk.assigned_staff_id, 'det-bacoor')
    assert.equal(walk.sale_line_items[0].pay_category, 'detailing')
  })

  it('4 merch sale is not wash and not detailing commission path', () => {
    const merch = sales.find((s) => s.id === 'sale-bacoor-merch')
    assert.equal(merch.sale_line_items[0].pay_category, 'merch')
    assert.equal(merch.sale_line_items[0].catalog_kind, 'product')
    assert.equal(classifySaleBucket(merch) === 'carwash', false)
  })

  it('5 mixed payment methods present across shop-day sales', () => {
    const methods = new Set(sales.map((s) => s.payment_method))
    assert.ok(methods.has('cash'))
    assert.ok(methods.has('gcash'))
    assert.ok(methods.has('card'))
  })

  it('6 CA repayment does not count in Total Sales (contract A1 / B2)', () => {
    const ca = buildCaRepaymentExpense()
    assert.equal(ca.kind, 'ca_repayment')
    const salesOnly = paidTotal(sales)
    // CA repayment is an expense row, not a sale — sales total unchanged
    assert.equal(salesOnly, 200_000 + 100_000 + 1_000_000 + 50_000 + 350_000)
    assert.equal(ca.amount_minor, 20_000)
  })

  it('7 Total sales = sum of paid POS tickets (A1)', () => {
    assert.equal(paidTotal(sales), 1_700_000)
    const byBranch = {
      [BACOOR]: paidTotal(sales.filter((s) => s.branch === BACOOR)),
      [IMUS]: paidTotal(sales.filter((s) => s.branch === IMUS)),
    }
    assert.equal(byBranch[BACOOR], 600_000)
    assert.equal(byBranch[IMUS], 1_100_000)
  })

  it('wiring: PosPage and handoff complete path exist', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(pos, /complete_pos_sale|completePosSale|handoff/i)
  })
})
