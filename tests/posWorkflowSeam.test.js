import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  keepQueueHandoffWhenAdding,
  posCartBlocksCheckout,
  cashAdvanceVisibleOnPos,
  expenseCountsOnDailyClose,
  buildVisitHandoffCartLines,
} from '../src/lib/posSale.js'
import { buildBacoorDailyReport } from '../src/lib/bacoorDailyReport.js'
import { classifySaleBucket, paidSalesToBacoorRows, posBucketToBacoor } from '../src/lib/posSellables.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('POS checkout workflow seam', () => {
  it('keeps a queue handoff when adding merch, detaches when adding a walk-in service', () => {
    assert.equal(keepQueueHandoffWhenAdding({ item_type: 'product', id: 'p1' }), true)
    assert.equal(keepQueueHandoffWhenAdding({ item_type: 'service', id: 's1' }), false)
  })

  it('blocks pay when a service line has no catalog service_id', () => {
    assert.equal(
      posCartBlocksCheckout([{ item_type: 'service', missing_service: true, id: null }]),
      true,
    )
    assert.equal(
      posCartBlocksCheckout([{ item_type: 'service', id: 'svc-1' }, { item_type: 'product', id: 'p1' }]),
      false,
    )
  })

  it('blocks pay when a package/detailing line has no service_id (normalized as service)', () => {
    assert.equal(
      posCartBlocksCheckout([{ item_type: 'package', id: null, missing_service: true }]),
      true,
    )
    assert.equal(posCartBlocksCheckout([{ item_type: 'detailing', id: 'svc-d1' }]), false)
  })

  it('normalizes package and detailing cart lines to service for complete_pos_sale', async () => {
    const { buildPosSalePayload, normalizePosLineItemType } = await import('../src/lib/posSale.js')
    assert.equal(normalizePosLineItemType('package'), 'service')
    assert.equal(normalizePosLineItemType('detailing'), 'service')
    assert.equal(normalizePosLineItemType('product'), 'product')
    const payload = buildPosSalePayload({
      branch: 'bacoor',
      paymentMethod: 'cash',
      cart: [
        { item_type: 'package', id: 'pkg-1', name: 'Express', quantity: 1, unit_price_minor: 50000 },
        { item_type: 'detailing', id: 'det-1', name: 'Ceramic', quantity: 1, unit_price_minor: 900000 },
      ],
    })
    assert.deepEqual(
      payload.lines.map((l) => ({ item_type: l.item_type, service_id: l.service_id, product_id: l.product_id })),
      [
        { item_type: 'service', service_id: 'pkg-1', product_id: null },
        { item_type: 'service', service_id: 'det-1', product_id: null },
      ],
    )
  })

  it('handoff after pay uses bay catalog tab not legacy services', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(pos, /setTab\(branchAdmin \? 'merch' : 'bay'\)/)
    assert.doesNotMatch(pos, /setTab\(branchAdmin \? 'merch' : 'services'\)/)
  })

  it('Sell tab links to Pay queue instead of duplicating handoff cards', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(pos, /Open Pay queue/)
    assert.doesNotMatch(pos, /Waiting for payment/)
  })

  it('cash advance inbox is fail-closed: kind + branch, never empty-branch leak', () => {
    const ca = (branch) => ({
      ops_forms: { kind: 'cash_advance' },
      payload: { branch },
    })
    assert.equal(cashAdvanceVisibleOnPos(ca(''), { posBranch: 'bacoor', branchScopeList: ['bacoor'] }), false)
    assert.equal(cashAdvanceVisibleOnPos(ca('imus'), { posBranch: 'bacoor', branchScopeList: ['bacoor'] }), false)
    assert.equal(cashAdvanceVisibleOnPos(ca('bacoor'), { posBranch: 'bacoor', branchScopeList: ['bacoor'] }), true)
    assert.equal(cashAdvanceVisibleOnPos({ ops_forms: { kind: 'complaint' }, payload: { branch: 'bacoor' } }, { posBranch: 'bacoor', branchScopeList: null }), false)
    assert.equal(cashAdvanceVisibleOnPos(ca('bacoor'), { posBranch: 'bacoor', branchScopeList: null }), true)
    assert.equal(cashAdvanceVisibleOnPos(ca('bacoor'), { branch: 'bacoor', branchScopeList: null }), true)
  })

  it('PPF pay_category is PPF on tiles and Bacoor close, not Queue wash', () => {
    assert.equal(classifySaleBucket({ payCategory: 'ppf' }), 'ppf')
    assert.equal(posBucketToBacoor('ppf'), 'ppf')
    const rows = paidSalesToBacoorRows([
      { status: 'paid', total_minor: 150000, payment_method: 'cash', pay_category: 'ppf' },
    ])
    assert.equal(rows[0].bucket, 'ppf')
  })

  it('POS page keeps handoff on merch add, gates expense, loads approved CA for close only', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(pos, /keepQueueHandoffWhenAdding/)
    assert.match(pos, /posCartBlocksCheckout/)
    assert.match(pos, /cashAdvanceVisibleOnPos/)
    assert.match(pos, /canWriteFinance\(profile\)/)
    assert.match(pos, /loadApprovedCashAdvances/)
    assert.match(pos, /const SHELL_TABS = \['checkout', 'pending', 'expenses', 'dashboard'\]/)
    assert.doesNotMatch(pos, /TabsTrigger value="cash-advance"/)
    assert.match(pos, /\/operations\/payroll\?tab=cash-advance/)
    assert.doesNotMatch(pos, /SHELL_TABS = \[[^\]]*'services'/)
    assert.match(pos, /writeAudit/)
    assert.match(pos, /notify-pos/)
    assert.match(pos, /buildVisitHandoffCartLines/)
    assert.match(pos, /expenseCountsOnDailyClose/)
    const payroll = readFileSync(join(root, 'src/pages/PayrollPage.jsx'), 'utf8')
    assert.match(payroll, /cash-advance/)
    assert.match(payroll, /PayrollCashAdvancesPanel/)
  })

  it('complete_pos_sale rejects null service_id and settles pending_payment transactions', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260819081507_complete_pos_sale_settle_txn.sql'),
      'utf8',
    )
    assert.match(sql, /create or replace function public\.complete_pos_sale/)
    assert.match(sql, /service_id is required/)
    assert.match(sql, /pending_payment/)
    assert.match(sql, /pos_handoff_id = v_handoff/)
  })

  it('complete_pos_sale refuses a second pay on the same handoff', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260819133000_pos_handoff_one_sale.sql'),
      'utf8',
    )
    assert.match(sql, /already paid/)
    assert.match(sql, /for update/)
    assert.match(sql, /sales_pos_handoff_paid_uidx/)
    assert.match(sql, /status = 'voided'/)
    assert.match(sql, /sales_status_check/)
  })

  it('daily close skips ceramic/payroll drafts and pending payment; counts POS day expenses', () => {
    assert.equal(
      expenseCountsOnDailyClose({
        status: 'draft',
        description: 'ceramic:sale-1:crew',
        expense_kind: 'salary_carwash',
      }),
      false,
    )
    assert.equal(
      expenseCountsOnDailyClose({
        status: 'paid',
        description: 'ceramic:sale-1:crew',
        expense_kind: 'salary_carwash',
      }),
      true,
    )
    assert.equal(
      expenseCountsOnDailyClose({ status: 'draft', description: null, expense_kind: 'daily', title: 'ice' }),
      true,
    )
    assert.equal(
      expenseCountsOnDailyClose({ status: 'pending_payment', description: 'expense_report:x:y', expense_kind: 'other' }),
      false,
    )
    assert.equal(
      expenseCountsOnDailyClose({ status: 'pending_approval', description: null, expense_kind: 'daily' }),
      false,
    )
    const report = buildBacoorDailyReport({
      branch: 'bacoor',
      date: '2026-08-19',
      sales: [],
      expenses: [
        { status: 'draft', description: 'ceramic:x:crew', expense_kind: 'salary_carwash', amount_minor: 40000, label: 'crew' },
        { status: 'draft', expense_kind: 'daily', amount_minor: 2000, label: 'ice' },
        { status: 'pending_payment', expense_kind: 'other', amount_minor: 9000, label: 'utilities' },
      ],
    })
    assert.equal(report.carwash_salary_minor, 0)
    assert.equal(report.total_expenses_minor, 2000)
  })

  it('visit-group handoff explodes into one receipt line per booking', () => {
    const lines = buildVisitHandoffCartLines({
      handoff: { id: 'h1', amount_minor: 80000, bookings: { id: 'b1', service_id: 's1', vehicle_plate: 'ABC' } },
      siblings: [
        { id: 'b1', service_id: 's1', final_price_minor: 50000, vehicle_plate: 'ABC' },
        { id: 'b2', service_id: 's2', final_price_minor: 30000, vehicle_plate: 'ABC' },
      ],
      services: [
        { id: 's1', name: 'Wash', pay_category: 'wash' },
        { id: 's2', name: 'Interior', pay_category: 'wash' },
      ],
    })
    assert.equal(lines.length, 2)
    assert.equal(lines[0].unit_price_minor + lines[1].unit_price_minor, 80000)
    assert.equal(lines[0].id, 's1')
    assert.equal(lines[1].id, 's2')
    assert.notEqual(lines[0].key, lines[1].key)
  })

  it('complete_pos_sale writes an audit row for Super Admin proof', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260819120000_pos_sale_audit.sql'),
      'utf8',
    )
    assert.match(sql, /create or replace function public\.complete_pos_sale/)
    assert.match(sql, /insert into public\.audit_logs/)
    assert.match(sql, /pos\.sale/)
  })
})
