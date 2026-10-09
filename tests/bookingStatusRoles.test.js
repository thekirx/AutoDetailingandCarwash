/**
 * Seam S1 — /api/booking-status role gate (pure function).
 *
 * The service role bypasses `bookings` RLS, so this function IS the real
 * authorization boundary. Every assertion here is an observable outcome
 * computed independently of the implementation.
 *
 * B2 regression: `detailer` was absent from both the ALLOWED set in
 * bookingStatus.mjs and the role arms here, so every Detailer status change
 * 403'd even though permissions.js:474 grants canAdvanceBookingStatus.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canStaffUpdateBookingStatus } from '../server/bookingStatusAccess.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const BOOKING = { branch: 'bacoor', status: 'waiting' }
const staff = (role, extra = {}) => ({ role, branch_slug: 'bacoor', ...extra })

test('detailer may advance a booking inside their own branch', () => {
  for (const next of ['in_progress', 'final_checking', 'for_releasing']) {
    assert.equal(
      canStaffUpdateBookingStatus(staff('detailer'), BOOKING, { nextStatus: next }),
      true,
      `detailer should be able to advance to ${next}`,
    )
  }
})

test('detailer is denied outside their branch', () => {
  assert.equal(
    canStaffUpdateBookingStatus(staff('detailer', { branch_slug: 'batangas' }), BOOKING, {
      nextStatus: 'in_progress',
    }),
    false,
  )
})

test('detailer is denied a booking with no branch', () => {
  assert.equal(
    canStaffUpdateBookingStatus(staff('detailer'), { branch: null, status: 'waiting' }, {
      nextStatus: 'in_progress',
    }),
    false,
  )
})

test('detailer cannot hand off to payment — that lane is Admin / POS', () => {
  assert.equal(
    canStaffUpdateBookingStatus(staff('detailer'), BOOKING, { nextStatus: 'for_payment' }),
    false,
  )
})

test('detailer is denied branch reassignment (sales / SA / ASA only)', () => {
  const src = read('server/bookingStatus.mjs')
  const gate = src.slice(src.indexOf('canAssignBranch'))
  assert.match(
    gate,
    /staff\.role === 'sales'[\s\S]{0,200}staff\.role === 'BossMich'[\s\S]{0,200}staff\.role === 'assistant_super_admin'/,
    'branch reassignment must stay limited to sales / SA / ASA',
  )
  assert.doesNotMatch(gate, /role === 'detailer'/)
})

// ── full role matrix (Slice I1) ───────────────────────────────────────────

test('role matrix: everyone who may write, may write', () => {
  const allowed = [
    ['BossMich', {}],
    ['assistant_super_admin', {}],
    ['team_lead', {}],
    ['sales', {}],
    ['detailer', {}],
    ['operations_lead', {}],
  ]
  const detailing = { ...BOOKING, services: { slug: 'ppf-basic', pay_category: 'detailing' } }
  for (const [role, extra] of allowed) {
    assert.equal(
      canStaffUpdateBookingStatus(staff(role, extra), detailing, { nextStatus: 'in_progress' }),
      true,
      `${role} should be allowed to advance a booking in their scope`,
    )
  }
})

test('role matrix: read-only roles are refused writes', () => {
  const denied = ['marketing', 'admin', 'investor', 'video_editor', 'staff', 'customer']
  for (const role of denied) {
    assert.equal(
      canStaffUpdateBookingStatus(staff(role), BOOKING, { nextStatus: 'in_progress' }),
      false,
      `${role} must not be able to change booking status`,
    )
  }
})

test('Super Admin bypasses branch scope (admins fix bad data)', () => {
  assert.equal(
    canStaffUpdateBookingStatus(staff('BossMich', { branch_slug: null }), BOOKING, {
      nextStatus: 'completed',
    }),
    true,
  )
})

test('ASA without queue_all is refused a non-CRM-safe status', () => {
  const asa = { role: 'assistant_super_admin', branch_slug: 'bacoor', permission_grants: { queue_all: false } }
  assert.equal(canStaffUpdateBookingStatus(asa, BOOKING, { nextStatus: 'in_progress' }), false)
})

test('ASA with queue_all is allowed', () => {
  const asa = { role: 'assistant_super_admin', branch_slug: 'bacoor', permission_grants: { queue_all: true } }
  assert.equal(canStaffUpdateBookingStatus(asa, BOOKING, { nextStatus: 'in_progress' }), true)
})

test('team_lead is denied the for_payment lane', () => {
  assert.equal(
    canStaffUpdateBookingStatus(staff('team_lead'), BOOKING, { nextStatus: 'for_payment' }),
    false,
  )
})

test('sales may only move detailing bookings to sales-board statuses', () => {
  const detailing = { ...BOOKING, services: { slug: 'ppf-basic', pay_category: 'detailing' } }
  const wash = { ...BOOKING, services: { slug: 'basic-wash', pay_category: 'wash' } }
  assert.equal(canStaffUpdateBookingStatus(staff('sales'), detailing, { nextStatus: 'for_payment' }), false)
  assert.equal(canStaffUpdateBookingStatus(staff('sales'), detailing, { nextStatus: 'in_progress' }), true)
  assert.equal(canStaffUpdateBookingStatus(staff('sales'), wash, { nextStatus: 'in_progress' }), false, 'wash is view only for Sales')
  assert.equal(canStaffUpdateBookingStatus(staff('sales'), BOOKING, { nextStatus: 'in_progress' }), false, 'unknown service is refused')
})

test('missing role or booking is refused', () => {
  assert.equal(canStaffUpdateBookingStatus(null, BOOKING, { nextStatus: 'in_progress' }), false)
  assert.equal(canStaffUpdateBookingStatus(staff('detailer'), null, { nextStatus: 'in_progress' }), false)
})

// ── seam guard: the ALLOWED set in the handler must match ─────────────────

test('bookingStatus.mjs ALLOWED includes every role this gate admits', () => {
  const src = read('server/bookingStatus.mjs')
  const set = src.match(/const ALLOWED = new Set\(\[([^\]]+)\]/)?.[1] || ''
  const roles = [...set.matchAll(/'([a-zA-Z_]+)'/g)].map((m) => m[1])
  for (const role of ['BossMich', 'assistant_super_admin', 'team_lead', 'sales', 'detailer', 'marketing']) {
    assert.ok(roles.includes(role), `ALLOWED must contain ${role} (found: ${roles.join(', ')})`)
  }
})