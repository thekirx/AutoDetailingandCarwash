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

describe('demo login is dev, or a deployment that explicitly opts in', () => {
  // CHANGED 2026-10-12 by owner decision: the chips are back on the deployed
  // site for testing. What did NOT change is the mechanism — the opt-in is a
  // build value that has to be set deliberately. BUG-088 was a *host* rule that
  // enabled itself the moment anything was deployed, so there is still no
  // hostname involved anywhere in this function.
  it('enables on DEV, and on a build that sets the flag explicitly', () => {
    assert.equal(isDemoLoginEnabled({ dev: true, flag: '', hostname: '' }), true)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: 'true', hostname: '' }), true)
  })

  it('stays off for every other value, including any host name', () => {
    assert.equal(isDemoLoginEnabled({ dev: false, flag: 'TRUE', hostname: '' }), false)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: '', hostname: 'hakum-autocare.vercel.app' }), false)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: '', hostname: 'hakumautocare.com' }), false)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: 'false', hostname: '' }), false)
  })

  it('a hostname can never enable it on its own — that was BUG-088', () => {
    // The regression this row exists to prevent. A host rule reads as harmless
    // in review and enables itself on deploy, which is how one-click Super Admin
    // ended up on the live site with the passwords in a public bundle.
    assert.equal(isDemoLoginEnabled({ dev: false, flag: '', hostname: 'hakum-autocare.vercel.app' }), false)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: undefined, hostname: 'anything.vercel.app' }), false)
  })
})
