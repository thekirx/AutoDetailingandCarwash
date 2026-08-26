/**
 * POS audit follow-up fixes: ceramic-eligible lines, payment allowlist, EoS hints.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  detailingAmountMinor,
  isCeramicCompensationLine,
  washPoolAmountMinor,
} from '../src/lib/compensation.js'
import {
  buildPosSalePayload,
  isAllowedPosPaymentMethod,
  priceCartForMembership,
} from '../src/lib/posSale.js'
import { shiftCloseFieldHint, shiftCloseFieldLabel } from '../src/lib/shiftClose.js'
import { buildBacoorDailyReport } from '../src/lib/bacoorDailyReport.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('POS audit follow-up fixes', () => {
  it('counts detailing catalog_kind and ceramic slugs for ceramic drafts, not PPF', () => {
    assert.equal(
      isCeramicCompensationLine({ catalog_kind: 'detailing', name: 'Ceramic Coating', pay_category: 'general' }),
      true,
    )
    assert.equal(
      isCeramicCompensationLine({ catalog_kind: 'detailing', name: 'Full PPF', slug: 'ppf-full', pay_category: 'ppf' }),
      false,
    )
    assert.equal(
      detailingAmountMinor([
        { catalog_kind: 'detailing', name: 'Ceramic Coating', unit_price_minor: 1000000, quantity: 1 },
        { pay_category: 'wash', unit_price_minor: 35000, quantity: 1 },
      ]),
      1000000,
    )
  })

  it('keeps wash pool free of detailing catalog lines', () => {
    const wash = washPoolAmountMinor({
      sale_line_items: [
        { pay_category: 'wash', line_total_minor: 35000 },
        { catalog_kind: 'detailing', pay_category: 'general', line_total_minor: 900000 },
      ],
    })
    assert.equal(wash, 35000)
  })

  it('normalizes package lines through membership pricing into service RPC types', () => {
    const priced = priceCartForMembership([
      { item_type: 'package', id: 'pkg-1', name: 'Express', price_minor: 50000, quantity: 1 },
    ])
    assert.equal(priced[0].item_type, 'service')
    const payload = buildPosSalePayload({
      branch: 'bacoor',
      paymentMethod: 'cash',
      cart: priced,
    })
    assert.equal(payload.lines[0].item_type, 'service')
    assert.equal(payload.lines[0].service_id, 'pkg-1')
  })

  it('allows only configured payment methods', () => {
    const methods = [
      { value: 'cash', label: 'Cash' },
      { value: 'gcash', label: 'GCash' },
    ]
    assert.equal(isAllowedPosPaymentMethod('cash', methods), true)
    assert.equal(isAllowedPosPaymentMethod('card', methods), false)
    assert.equal(isAllowedPosPaymentMethod('cash', []), true)
  })

  it('EoS labels and hints warn against double-counting CA', () => {
    assert.equal(shiftCloseFieldLabel('ca_collected_minor'), 'CA repaid to drawer')
    assert.match(shiftCloseFieldHint('ca_collected_minor'), /Do not re-enter/i)
  })

  it('daily report counts expense drafts for wizard honesty', () => {
    const report = buildBacoorDailyReport({
      branch: 'bacoor',
      date: '2026-08-22',
      sales: [{ status: 'paid', payment_method: 'cash', total_minor: 100000, bucket: 'carwash' }],
      expenses: [
        { expense_kind: 'daily', amount_minor: 5000, status: 'draft', label: 'Ice' },
        { expense_kind: 'daily', amount_minor: 2000, status: 'paid', label: 'Soap' },
      ],
    })
    assert.equal(report.expense_draft_count, 1)
    assert.equal(report.total_expenses_minor, 7000)
  })

  it('POS and Payroll wire settings entry and pending policy', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(pos, /settings\/pos/)
    assert.match(pos, /isAllowedPosPaymentMethod/)
    const payroll = readFileSync(join(root, 'src/pages/PayrollPage.jsx'), 'utf8')
    assert.match(payroll, /pending_floor_optional/)
    const wiz = readFileSync(join(root, 'src/components/ShiftCloseWizard.jsx'), 'utf8')
    assert.match(wiz, /Approved cash advances/)
    assert.match(wiz, /does not run payroll/)
  })
})
