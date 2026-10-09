/**
 * Seam S2 — booking status state machine.
 *
 * Expected values are literal and written independently of the implementation:
 * they describe the detailing board pipeline a crew actually walks.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canTransitionBookingStatus,
  canHandOffToPayment,
  transitionAllowedForRole,
  BOOKING_STATUS_TRANSITIONS,
} from '../server/bookingStatusTransitions.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

test('the legal detailing chain is walkable one step at a time', () => {
  const chain = ['pending', 'confirmed', 'waiting', 'in_progress', 'final_checking', 'completed']
  for (let i = 0; i < chain.length - 1; i += 1) {
    assert.equal(
      canTransitionBookingStatus(chain[i], chain[i + 1]),
      true,
      `${chain[i]} -> ${chain[i + 1]} must be legal`,
    )
  }
})

test('a booking may also start at waiting (public form books straight to waiting)', () => {
  assert.equal(canTransitionBookingStatus('pending', 'waiting'), true)
  assert.equal(canTransitionBookingStatus('waiting', 'in_progress'), true)
})

test('skipping Final checking is refused', () => {
  // BUG-050: this was reachable and skipped the QA gate that carries money.
  assert.equal(canTransitionBookingStatus('waiting', 'completed'), false)
  assert.equal(canTransitionBookingStatus('waiting', 'final_checking'), false)
  assert.equal(canTransitionBookingStatus('in_progress', 'completed'), false)
  assert.equal(canTransitionBookingStatus('pending', 'completed'), false)
})

test('skipping ahead in the pipeline is refused', () => {
  assert.equal(canTransitionBookingStatus('pending', 'in_progress'), false)
  assert.equal(canTransitionBookingStatus('pending', 'final_checking'), false)
  assert.equal(canTransitionBookingStatus('waiting', 'for_releasing'), false)
})

test('terminal states accept nothing', () => {
  for (const from of ['completed', 'cancelled', 'no_show']) {
    for (const to of Object.keys(BOOKING_STATUS_TRANSITIONS)) {
      assert.equal(canTransitionBookingStatus(from, to), false, `${from} -> ${to} must be refused`)
    }
  }
})

test('for_payment is never a bare target — POS owns that lane', () => {
  for (const from of ['pending', 'confirmed', 'waiting', 'in_progress', 'final_checking', 'for_releasing']) {
    assert.equal(
      canTransitionBookingStatus(from, 'for_payment'),
      false,
      `${from} -> for_payment must go through the handoff branch`,
    )
  }
})

test('For releasing is retired: Final checking hands straight to POS', () => {
  assert.equal(canTransitionBookingStatus('final_checking', 'for_releasing'), false)
  assert.equal(canHandOffToPayment('final_checking'), true)
  assert.equal(canHandOffToPayment('for_releasing'), true, 'legacy rows can still reach POS')
  for (const from of ['pending', 'confirmed', 'waiting', 'in_progress', 'redo', 'completed']) {
    assert.equal(canHandOffToPayment(from), false, `${from} skips QA`)
  }
  assert.equal(transitionAllowedForRole('final_checking', 'for_payment', 'team_lead'), true)
  assert.equal(transitionAllowedForRole('in_progress', 'for_payment', 'team_lead'), false)
  assert.equal(transitionAllowedForRole('waiting', 'for_payment', 'sales'), false)
})

test('same-status is refused as a no-op', () => {
  for (const status of Object.keys(BOOKING_STATUS_TRANSITIONS)) {
    assert.equal(canTransitionBookingStatus(status, status), false, `${status} -> ${status} is a no-op`)
  }
})

test('cancelling is allowed from any live stage', () => {
  for (const from of ['pending', 'confirmed', 'waiting', 'in_progress', 'final_checking', 'for_releasing', 'redo']) {
    assert.equal(canTransitionBookingStatus(from, 'cancelled'), true, `${from} -> cancelled must be legal`)
  }
})

test('a failed QA returns the job to in progress', () => {
  assert.equal(canTransitionBookingStatus('in_progress', 'redo'), true)
  assert.equal(canTransitionBookingStatus('redo', 'in_progress'), true)
})

test('no_show is reachable only while waiting', () => {
  assert.equal(canTransitionBookingStatus('waiting', 'no_show'), true)
  assert.equal(canTransitionBookingStatus('in_progress', 'no_show'), false)
  assert.equal(canTransitionBookingStatus('final_checking', 'no_show'), false)
})

test('unknown or empty statuses are refused, never thrown on', () => {
  assert.equal(canTransitionBookingStatus(null, 'waiting'), false)
  assert.equal(canTransitionBookingStatus('waiting', null), false)
  assert.equal(canTransitionBookingStatus('', ''), false)
  assert.equal(canTransitionBookingStatus('not_a_status', 'waiting'), false)
  assert.equal(canTransitionBookingStatus('waiting', 'not_a_status'), false)
})

test('Super Admin bypasses the ladder; no other role does', () => {
  assert.equal(transitionAllowedForRole('waiting', 'completed', 'BossMich'), true)
  assert.equal(transitionAllowedForRole('completed', 'waiting', 'BossMich'), true)
  for (const role of ['team_lead', 'sales', 'detailer', 'operations_lead', 'assistant_super_admin']) {
    assert.equal(
      transitionAllowedForRole('waiting', 'completed', role),
      false,
      `${role} must not bypass the ladder`,
    )
  }
})

test('the handler actually calls the state machine (seam guard)', () => {
  const src = read('server/bookingStatus.mjs')
  assert.match(src, /from '\.\/bookingStatusTransitions\.mjs'/)
  assert.match(src, /transitionAllowedForRole\(/)
  assert.match(
    src,
    /!transitionAllowedForRole\([^)]+\)[\s\S]{0,400}400/,
    'an invalid transition must answer 400, not 403',
  )
})

test('the handler gates on the CALLER role, not a hardcoded bypass', () => {
  // Guards against a future edit that quietly hands Super Admin's exemption to
  // every role (or to nobody), which would make the seam-guard above pass
  // while the ladder is not actually enforced for floor staff.
  const src = read('server/bookingStatus.mjs')
  const call = src.match(/transitionAllowedForRole\(([^)]*)\)/)
  assert.ok(call, 'transitionAllowedForRole must be called')
  assert.match(
    call[1],
    /staff\.role/,
    `the third argument must be the caller's role, got: ${call[1].trim()}`,
  )
})

test('the state-machine guard runs BEFORE the POS handoff branch', () => {
  // If the handoff branch ran first it would already have written status,
  // so a later ladder check could not undo it.
  const src = read('server/bookingStatus.mjs')
  const guardAt = src.indexOf('transitionAllowedForRole(existing.status')
  const handoffAt = src.indexOf('isPaymentHandoffStatus(status)')
  assert.ok(guardAt > -1 && handoffAt > -1, 'both must be present')
  assert.ok(guardAt < handoffAt, 'the ladder must be checked before the handoff branch')
})