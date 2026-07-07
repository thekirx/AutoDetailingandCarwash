import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ACTIVE_QUEUE_STATUSES,
  buildPublicQueueModel,
  getQueueCounts,
  isStaffAssignmentBusy,
  normalizeAssignmentStatus,
} from '../src/queue/queueLogic.js'

describe('queue logic', () => {
  it('counts only active public queue statuses', () => {
    const counts = getQueueCounts([
      { status: 'waiting' },
      { status: 'waiting' },
      { status: 'in_progress' },
      { status: 'final_checking' },
      { status: 'for_payment' },
      { status: 'completed' },
    ])

    assert.deepEqual(counts, {
      waiting: 2,
      in_progress: 1,
      final_checking: 1,
      total: 4,
    })
  })

  it('builds a public model with queue numbers only', () => {
    const model = buildPublicQueueModel([
      {
        branch: 'bacoor',
        queue_number: 12,
        status: 'in_progress',
        customer_name: 'Private',
        plate_number: 'ABC123',
        service_name: 'Premium Wash',
      },
      { branch: 'bacoor', queue_number: 13, status: 'for_payment' },
      { branch: 'batangas', queue_number: 3, status: 'waiting' },
    ], 'bacoor')

    assert.equal(model.counts.total, 1)
    assert.deepEqual(model.groups.in_progress, [{ queueNumber: 'Q-012', status: 'in_progress' }])
    assert.equal(JSON.stringify(model).includes('Private'), false)
    assert.equal(JSON.stringify(model).includes('ABC123'), false)
    assert.equal(JSON.stringify(model).includes('Premium Wash'), false)
  })

  it('treats active assignments on active tickets as busy only', () => {
    assert.equal(isStaffAssignmentBusy({ status: 'active', booking_status: 'in_progress' }), true)
    assert.equal(isStaffAssignmentBusy({ status: 'released', booking_status: 'in_progress' }), false)
    assert.equal(isStaffAssignmentBusy({ status: 'active', booking_status: 'for_payment' }), false)
  })

  it('normalizes legacy assignment statuses into the MVP statuses', () => {
    assert.equal(normalizeAssignmentStatus('assigned'), 'active')
    assert.equal(normalizeAssignmentStatus('in_progress'), 'active')
    assert.equal(normalizeAssignmentStatus('completed'), 'released')
    assert.equal(normalizeAssignmentStatus('released'), 'released')
    assert.deepEqual(ACTIVE_QUEUE_STATUSES, ['waiting', 'in_progress', 'final_checking'])
  })
})
