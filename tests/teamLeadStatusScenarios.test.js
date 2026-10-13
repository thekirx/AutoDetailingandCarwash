import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canTransitionQueueStatus,
  getOpsBoardStatuses,
  getQueueTicketActionFlags,
  QUEUE_STATUS_TRANSITIONS,
  REDO_FROM_STATUSES,
} from '../src/queue/queueLogic.js'
import { finalCheckActionLabel } from '../src/lib/uiDeadControls.js'
import { isDemoLoginEnabled } from '../src/lib/demoLogin.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const editor = readFileSync(join(root, 'src/components/QueueTicketEditor.jsx'), 'utf8')
const api = readFileSync(join(root, 'src/queue/queueApi.js'), 'utf8')

const TL = { canManageQueue: true, canViewRedoLane: false, canPushToPayment: true }
const SA = { canManageQueue: true, canViewRedoLane: true, canPushToPayment: false }
const VIEWER = { canManageQueue: false, canViewRedoLane: false, canPushToPayment: false }

describe('TL queue status transitions (principal scenarios)', () => {
  it('allows floor path waiting → in_progress → final_checking + cancel', () => {
    assert.equal(canTransitionQueueStatus('waiting', 'in_progress'), true)
    assert.equal(canTransitionQueueStatus('in_progress', 'final_checking'), true)
    assert.equal(canTransitionQueueStatus('waiting', 'cancelled'), true)
    assert.equal(canTransitionQueueStatus('in_progress', 'cancelled'), true)
    assert.equal(canTransitionQueueStatus('final_checking', 'cancelled'), true)
    assert.equal(canTransitionQueueStatus('waiting', 'final_checking'), false)
    assert.equal(canTransitionQueueStatus('waiting', 'for_payment'), false)
    assert.equal(canTransitionQueueStatus('final_checking', 'for_payment'), false)
    assert.equal(canTransitionQueueStatus('for_payment', 'completed'), false)
  })

  it('allows restart from redo → in_progress only', () => {
    assert.equal(canTransitionQueueStatus('redo', 'in_progress'), true)
    assert.equal(canTransitionQueueStatus('redo', 'final_checking'), false)
    assert.deepEqual(QUEUE_STATUS_TRANSITIONS.redo, ['in_progress'])
  })

  it('TL waiting: Start + Cancel', () => {
    const f = getQueueTicketActionFlags('waiting', TL)
    assert.deepEqual(f, {
      canStart: true,
      canFinalCheck: false,
      canSendToPayment: false,
      canMarkRedo: false,
      canMarkFailedQa: false,
      canCancel: true,
    })
  })

  it('TL in_progress: Final check + Cancel (no payment)', () => {
    const f = getQueueTicketActionFlags('in_progress', TL)
    assert.deepEqual(f, {
      canStart: false,
      canFinalCheck: true,
      canSendToPayment: false,
      canMarkRedo: false,
      canMarkFailedQa: false,
      canCancel: true,
    })
  })

  it('TL final_checking: Send to payment + Cancel', () => {
    const f = getQueueTicketActionFlags('final_checking', TL)
    assert.deepEqual(f, {
      canStart: false,
      canFinalCheck: false,
      canSendToPayment: true,
      canMarkRedo: false,
      canMarkFailedQa: false,
      canCancel: true,
    })
  })

  it('SA final_checking: no Send to payment (only the TL pushes it on)', () => {
    const f = getQueueTicketActionFlags('final_checking', SA)
    assert.equal(f.canSendToPayment, false)
    assert.equal(f.canCancel, true)
  })

  it('TL for_payment / completed / cancelled: no status buttons', () => {
    for (const status of ['for_payment', 'completed', 'cancelled']) {
      assert.deepEqual(getQueueTicketActionFlags(status, TL), {
        canStart: false,
        canFinalCheck: false,
        canSendToPayment: false,
        canMarkRedo: false,
        canMarkFailedQa: false,
        canCancel: false,
      })
    }
  })

  it('SA can mark redo; TL cannot', () => {
    assert.equal(getQueueTicketActionFlags('redo', TL).canStart, false)
    assert.equal(getQueueTicketActionFlags('redo', SA).canStart, true)
    for (const status of REDO_FROM_STATUSES) {
      assert.equal(getQueueTicketActionFlags(status, SA).canMarkRedo, true)
      assert.equal(getQueueTicketActionFlags(status, TL).canMarkRedo, false)
    }
    assert.equal(getQueueTicketActionFlags('waiting', SA).canMarkRedo, false)
  })

  it('viewer has no actions', () => {
    assert.deepEqual(getQueueTicketActionFlags('waiting', VIEWER), {
      canStart: false,
      canFinalCheck: false,
      canSendToPayment: false,
      canMarkRedo: false,
      canMarkFailedQa: false,
      canCancel: false,
    })
  })

  it('TL board includes Services Failed QA without exposing payment', () => {
    assert.deepEqual(getOpsBoardStatuses({ role: 'team_lead' }), ['waiting', 'in_progress', 'final_checking', 'redo'])
  })

  it('final check label stays on floor for TL', () => {
    assert.equal(finalCheckActionLabel(false), 'Final check')
    assert.equal(finalCheckActionLabel(true), 'Final check')
  })

  it('updateTicketStatus writes final_checking and uses cancelQueueTicket', () => {
    assert.match(api, /canTransitionQueueStatus/)
    assert.match(api, /final_checking_at/)
    assert.match(api, /cancelQueueTicket/)
    assert.match(api, /cancellation_reason/)
    assert.doesNotMatch(api, /Never write status=final_checking first/)
  })

  it('QueueTicketEditor wires shared action flags + cancel', () => {
    assert.match(editor, /getQueueTicketActionFlags/)
    assert.match(editor, /actions\.canStart/)
    assert.match(editor, /actions\.canFinalCheck/)
    assert.match(editor, /actions\.canSendToPayment/)
    assert.match(editor, /actions\.canCancel/)
    assert.match(editor, /cancelQueueTicket/)
  })
})

describe('demo login is on by default, with one opt-out', () => {
  // CHANGED 2026-10-13 by owner decision, second time. The previous default was
  // fail-closed (`flag === 'true'`); the owner asked for the chips to be visible
  // on the deployed site and cannot set Vercel env vars from the repo. So the
  // default is now ON and the single opt-out is `false`.
  //
  // What did NOT change, and is the part these rows actually protect: the
  // decision is a VALUE someone sets. BUG-088 was a host rule that enabled
  // itself on deploy, so there is still no hostname anywhere in this function.
  it('is on with no flag at all, which is the whole point of the change', () => {
    assert.equal(isDemoLoginEnabled({ dev: false, flag: '', hostname: '' }), true)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: undefined, hostname: '' }), true)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: 'true', hostname: '' }), true)
  })

  it('is off only for the exact string "false"', () => {
    assert.equal(isDemoLoginEnabled({ dev: false, flag: 'false', hostname: '' }), false)
  })

  it('is never turned on by dev being false, and never off by dev being true', () => {
    // DEV is additive, not authoritative: a local run keeps the chips whatever
    // the flag says, because you already have the machine.
    assert.equal(isDemoLoginEnabled({ dev: true, flag: 'false', hostname: '' }), true)
  })

  it('a hostname can never enable or disable it — that was BUG-088', () => {
    // The regression this row exists to prevent. A host rule reads as harmless
    // in review and enables itself on deploy, which is how one-click Super Admin
    // ended up on the live site with the passwords in a public bundle.
    // Comment-stripped: this file's own prose is about that word.
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src/lib/demoLogin.js'), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    assert.doesNotMatch(src, /hostname|location\.host/, 'the gate must not consult the host again')
  })
})
