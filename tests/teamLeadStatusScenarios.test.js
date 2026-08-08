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

const TL = { canManageQueue: true, canViewRedoLane: false, canSeePayment: false }
const SA = { canManageQueue: true, canViewRedoLane: true, canSeePayment: true }
const VIEWER = { canManageQueue: false, canViewRedoLane: false, canSeePayment: false }

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
      canCancel: true,
    })
  })

  it('TL final_checking: Cancel only (Admin sends to payment)', () => {
    const f = getQueueTicketActionFlags('final_checking', TL)
    assert.deepEqual(f, {
      canStart: false,
      canFinalCheck: false,
      canSendToPayment: false,
      canMarkRedo: false,
      canCancel: true,
    })
  })

  it('Admin final_checking: Send to payment + Cancel', () => {
    const f = getQueueTicketActionFlags('final_checking', { ...TL, canSeePayment: true })
    assert.equal(f.canSendToPayment, true)
    assert.equal(f.canCancel, true)
  })

  it('TL for_payment / completed / cancelled: no status buttons', () => {
    for (const status of ['for_payment', 'completed', 'cancelled']) {
      assert.deepEqual(getQueueTicketActionFlags(status, TL), {
        canStart: false,
        canFinalCheck: false,
        canSendToPayment: false,
        canMarkRedo: false,
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
      canCancel: false,
    })
  })

  it('TL board has no redo column', () => {
    assert.deepEqual(getOpsBoardStatuses({ role: 'team_lead' }), ['waiting', 'in_progress', 'final_checking'])
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

describe('demo login for Vercel QA', () => {
  it('enables on DEV, flag, or *.vercel.app', () => {
    assert.equal(isDemoLoginEnabled({ dev: true, flag: '', hostname: '' }), true)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: 'true', hostname: '' }), true)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: 'TRUE', hostname: '' }), true)
    assert.equal(
      isDemoLoginEnabled({ dev: false, flag: '', hostname: 'hakum-autocare.vercel.app' }),
      true,
    )
    assert.equal(isDemoLoginEnabled({ dev: false, flag: '', hostname: 'hakumautocare.com' }), false)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: 'false', hostname: '' }), false)
  })
})
