/**
 * POS deep-audit leftovers: loyalty gate, catalog price trust, tender ref, draft cart, settings ACL.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canRedeemLoyaltyAward,
  isValidPaymentRef,
  paymentRefRequired,
  resolveCatalogListMinor,
  validatePosLinePrice,
  validatePosSaleCart,
  parsePosDraft,
  serializePosDraft,
  buildPosSalePayload,
} from '../src/lib/posSale.js'
import { canWritePosSettings } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const washMilestone = [{ threshold_points: 10, is_active: true, reward_label: 'Free wash' }]

describe('loyalty award gate', () => {
  it('refuses walk-in and unpaid stamp cards', () => {
    assert.equal(canRedeemLoyaltyAward({}), false)
    assert.equal(canRedeemLoyaltyAward({ customerId: 'c1', stamps: 3, milestones: washMilestone }), false)
    assert.equal(canRedeemLoyaltyAward({ customerId: 'c1', stamps: 10, milestones: washMilestone }), true)
  })

  it('allows one loyalty line per sale', () => {
    assert.equal(
      canRedeemLoyaltyAward({
        customerId: 'c1',
        stamps: 10,
        milestones: washMilestone,
        cart: [{ is_loyalty_award: true }],
      }),
      false,
    )
  })

  it('blocks checkout when a loyalty line has no redeemable customer', () => {
    const cart = [
      {
        item_type: 'service',
        id: 'svc-1',
        name: 'Wash',
        quantity: 1,
        unit_price_minor: 0,
        is_loyalty_award: true,
      },
    ]
    const blocked = validatePosSaleCart(cart, { paymentMethod: 'cash' })
    assert.equal(blocked.ok, false)
    assert.match(blocked.error, /customer/i)
  })
})

describe('catalog price trust', () => {
  const products = [{ id: 'p1', price_minor: 150000 }]
  const services = [{ id: 's1', price_minor: 35000, size_prices: { medium: 35000, large: 45000 } }]

  it('resolves merch and sized-service list prices from catalog', () => {
    assert.equal(resolveCatalogListMinor({ item_type: 'product', id: 'p1' }, { products, services }), 150000)
    assert.equal(
      resolveCatalogListMinor({ item_type: 'service', id: 's1', vehicle_size: 'large' }, { products, services }),
      45000,
    )
  })

  it('rejects a line priced above catalog', () => {
    const r = validatePosLinePrice(
      { item_type: 'product', id: 'p1', name: 'Kit', unit_price_minor: 200000 },
      { products, services },
    )
    assert.equal(r.ok, false)
    assert.match(r.error, /above the catalog/i)
  })

  it('requires a reason when the unit is below catalog', () => {
    const missing = validatePosLinePrice(
      { item_type: 'product', id: 'p1', name: 'Kit', unit_price_minor: 100000 },
      { products, services },
    )
    assert.equal(missing.ok, false)
    const ok = validatePosLinePrice(
      {
        item_type: 'product',
        id: 'p1',
        name: 'Kit',
        unit_price_minor: 100000,
        adhoc_discount_reason: 'staff meal',
      },
      { products, services },
    )
    assert.equal(ok.ok, true)
  })
})

describe('non-cash tender reference', () => {
  it('requires 4+ characters for GCash and card', () => {
    assert.equal(paymentRefRequired('cash'), false)
    assert.equal(paymentRefRequired('gcash'), true)
    assert.equal(isValidPaymentRef('gcash', 'ab'), false)
    assert.equal(isValidPaymentRef('gcash', 'GC-9921'), true)
    assert.equal(isValidPaymentRef('cash', ''), true)
  })

  it('puts payment_ref on the sale payload', () => {
    const payload = buildPosSalePayload({
      branch: 'bacoor',
      paymentMethod: 'gcash',
      paymentRef: 'GC-9921',
      discountReason: 'vip',
      discountMinor: 5000,
      cart: [{ item_type: 'service', id: 'svc-1', name: 'Wash', quantity: 1, unit_price_minor: 35000 }],
    })
    assert.equal(payload.payment_ref, 'GC-9921')
    assert.equal(payload.discount_reason, 'vip')
    assert.equal(payload.discount_minor, 5000)
  })
})

describe('in-progress draft cart', () => {
  it('round-trips cart + customer for one branch', () => {
    const raw = serializePosDraft('bacoor', {
      cart: [{ key: 'p1', name: 'Kit', quantity: 1, unit_price_minor: 150000 }],
      customerId: 'c1',
      paymentMethod: 'cash',
      cashTendered: '2000',
    })
    const draft = parsePosDraft(raw, 'bacoor')
    assert.equal(draft.cart[0].name, 'Kit')
    assert.equal(draft.customerId, 'c1')
    assert.equal(parsePosDraft(raw, 'sucat'), null)
  })
})

describe('settings write ACL matches RLS', () => {
  it('lets Super Admin and ASA finance_write, not Branch Admin', () => {
    assert.equal(canWritePosSettings({ role: 'BossMich' }), true)
    assert.equal(canWritePosSettings({ role: 'assistant_super_admin', permission_grants: { finance_write: true } }), true)
    assert.equal(canWritePosSettings({ role: 'assistant_super_admin', permission_grants: { finance_write: false } }), false)
    assert.equal(canWritePosSettings({ role: 'admin' }), false)
  })
})

describe('source seams', () => {
  it('POS no longer queries a missing expense_categories.is_active column', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.doesNotMatch(pos, /expense_categories[\s\S]{0,200}is_active/)
    assert.match(pos, /canRedeemLoyaltyAward/)
    assert.match(pos, /canWritePosSettings/)
    assert.match(pos, /paymentRef/)
    assert.match(pos, /readPosDraft|writePosDraft|parsePosDraft/)
  })

  it('scrollable ops tabs start at the leading item', () => {
    const bar = readFileSync(join(root, 'src/components/ops/OpsTabBar.jsx'), 'utf8')
    assert.match(bar, /justify-start/)
  })
})
