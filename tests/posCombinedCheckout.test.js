import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROLES, canDiscountPosSale } from '../src/auth/permissions.js'
import {
  assertBranchAdminCart,
  buildPosSalePayload,
  detachHandoffFromCart,
  openHandoffInCart,
  parsePosDraft,
  sanitizeBranchAdminCart,
  serializePosDraft,
  summarizePosCart,
} from '../src/lib/posSale.js'
import { POS_SHELL_TABS, formatQueueTicket, resolvePosShellTab } from '../src/lib/posInsights.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ticketLine = { key: 'handoff-h1', item_type: 'service', id: 's1', name: 'Wash', quantity: 1, unit_price_minor: 50000, from_handoff: true }
const coffee = { key: 'p-coffee', item_type: 'product', id: 'p1', name: 'Latte', quantity: 2, unit_price_minor: 15000, list_price_minor: 15000 }
const walkInService = { key: 's2-medium', item_type: 'service', id: 's2', name: 'Interior', quantity: 1, unit_price_minor: 30000 }

describe('POS combined checkout — ticket + add-ons on one sale', () => {
  it('opening a ticket keeps merch already rung up and drops the previous ticket and walk-in services', () => {
    const oldTicket = { ...ticketLine, key: 'handoff-old' }
    const next = openHandoffInCart([oldTicket, walkInService, coffee], [ticketLine])
    assert.deepEqual(next.map((l) => l.key), ['handoff-h1', 'p-coffee'])
  })

  it('detaching a ticket removes only its locked lines', () => {
    assert.deepEqual(detachHandoffFromCart([ticketLine, coffee]).map((l) => l.key), ['p-coffee'])
  })

  it('summarizes ticket vs add-ons vs savings for the order summary', () => {
    const discounted = { ...coffee, key: 'p-cap', quantity: 1, list_price_minor: 20000, unit_price_minor: 18000, adhoc_discount_applied: true }
    const member = { ...walkInService, list_price_minor: 30000, unit_price_minor: 27000, membership_discount_applied: true }
    const s = summarizePosCart([ticketLine, coffee, discounted, member])
    assert.equal(s.ticketMinor, 50000)
    assert.equal(s.addOnMinor, 30000 + 18000 + 27000)
    assert.equal(s.discountMinor, 2000)
    assert.equal(s.memberMinor, 3000)
    assert.equal(s.totalMinor, 50000 + 75000)
    assert.equal(s.ticketCount, 1)
    assert.equal(s.addOnCount, 4)
  })

  it('a merch add-on on a ticket posts as one sale linked to booking, handoff and customer', () => {
    const payload = buildPosSalePayload({
      branch: 'bacoor',
      paymentMethod: 'cash',
      cart: [ticketLine, coffee],
      activeHandoff: { id: 'h1', booking_id: 'b1', bookings: { customer_id: 'c1', vehicle_plate: 'ABC 123' } },
    })
    assert.equal(payload.booking_id, 'b1')
    assert.equal(payload.pos_handoff_id, 'h1')
    assert.equal(payload.customer_id, 'c1')
    assert.deepEqual(
      payload.lines.map((l) => [l.item_type, l.service_id, l.product_id]),
      [['service', 's1', null], ['product', null, 'p1']],
    )
  })

  it('the cart draft remembers the open ticket so a reload stays linked', () => {
    const handoff = { id: 'h1', booking_id: 'b1', bookings: { queue_number: 7 } }
    const draft = parsePosDraft(serializePosDraft('bacoor', { cart: [ticketLine], activeHandoff: handoff }), 'bacoor')
    assert.deepEqual(draft.activeHandoff, handoff)
    assert.equal(parsePosDraft(serializePosDraft('bacoor', { cart: [] }), 'bacoor').activeHandoff, null)
  })
})

describe('POS combined checkout — roles and shell', () => {
  it('Branch Admin cannot discount; Super Admin and ASA with POS can', () => {
    assert.equal(canDiscountPosSale({ role: ROLES.ADMIN }), false)
    assert.equal(canDiscountPosSale({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canDiscountPosSale({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { pos: true } }), true)
    assert.equal(canDiscountPosSale({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { pos: false } }), false)
    assert.equal(canDiscountPosSale(null), false)
  })

  it('Pay queue merges into Sell — no pending tab, legacy links land on checkout', () => {
    assert.equal(POS_SHELL_TABS.includes('pending'), false)
    assert.equal(resolvePosShellTab('pending'), 'checkout')
  })

  it('formats the queue ticket number', () => {
    assert.equal(formatQueueTicket({ queue_number: 7 }), 'Q-007')
    assert.equal(formatQueueTicket({}), 'Queue')
  })

  it('PosPage lists open tickets beside the catalogue and gates discount by role', () => {
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.doesNotMatch(pos, /id: 'pending'/)
    assert.doesNotMatch(pos, /resolvePosLandingTab/)
    assert.match(pos, /<PosOpenTickets/)
    assert.match(pos, /canDiscountPosSale\(profile\)/)
    assert.match(pos, /openHandoffInCart/)
    assert.match(pos, /detachHandoffFromCart/)
    assert.match(pos, /sanitizeBranchAdminCart/)
    assert.match(pos, /assertBranchAdminCart/)
    assert.match(pos, /writePosDraft\(branch, \{[^}]*activeHandoff/)
  })

  it('Branch Admin cart keeps ticket + merch and strips walk-in services / discounts', () => {
    const dirty = [
      ticketLine,
      coffee,
      walkInService,
      {
        ...coffee,
        key: 'p-disc',
        list_price_minor: 15000,
        unit_price_minor: 10000,
        adhoc_discount_applied: true,
        adhoc_discount_reason: 'friend',
      },
    ]
    const clean = sanitizeBranchAdminCart(dirty)
    assert.deepEqual(clean.map((l) => l.key), ['handoff-h1', 'p-coffee', 'p-disc'])
    assert.equal(clean.find((l) => l.key === 'p-disc').unit_price_minor, 15000)
    assert.equal(clean.find((l) => l.key === 'p-disc').adhoc_discount_applied, false)
    assert.equal(assertBranchAdminCart(dirty, { isBranchAdmin: true }).ok, false)
    assert.equal(assertBranchAdminCart([ticketLine, coffee], { isBranchAdmin: true }).ok, true)
    assert.equal(assertBranchAdminCart([ticketLine, coffee], { isBranchAdmin: false }).ok, true)
    assert.match(
      assertBranchAdminCart([{ ...coffee, adhoc_discount_applied: true }], { isBranchAdmin: true }).error,
      /cannot discount/i,
    )
  })

  it('RPC migration enforces Branch Admin merch-only at complete_pos_sale', () => {
    const sql = readFileSync(join(root, 'supabase/migrations/20261005140000_ba_pos_merch_only.sql'), 'utf8')
    assert.match(sql, /assert_branch_admin_pos_cart/)
    assert.match(sql, /Branch Admin sells merch and coffee only/)
    assert.match(sql, /cannot apply POS discounts/)
    assert.match(sql, /perform public\.assert_branch_admin_pos_cart/)
    assert.match(sql, /do not skip via membership\/award flags/)
  })
})
