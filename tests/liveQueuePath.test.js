import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CUSTOMER_QUEUE_PATH,
  PUBLIC_QUEUE_POLL_MS,
  customerQueuePath,
  liveQueuePath,
  queueCountsFromRow,
} from '../src/lib/liveQueuePath.js'

describe('live queue paths', () => {
  it('keeps public kiosk paths on /queue', () => {
    assert.equal(liveQueuePath('bacoor'), '/queue/bacoor')
    assert.equal(liveQueuePath(''), '/queue')
  })

  it('keeps signed-in customers on /account/queue', () => {
    assert.equal(customerQueuePath(''), CUSTOMER_QUEUE_PATH)
    assert.equal(customerQueuePath('bacoor'), '/account/queue?branch=bacoor')
    assert.equal(customerQueuePath('hakum south'), '/account/queue?branch=hakum%20south')
  })

  it('maps count rows without leaking extra fields', () => {
    assert.deepEqual(queueCountsFromRow(null), {
      waiting: 0,
      in_progress: 0,
      final_checking: 0,
      total: 0,
    })
    assert.deepEqual(
      queueCountsFromRow({
        branch: 'bacoor',
        waiting_count: '2',
        in_progress_count: 1,
        final_checking_count: 0,
        total_active_count: 3,
        customer_phone: '0917',
      }),
      { waiting: 2, in_progress: 1, final_checking: 0, total: 3 },
    )
    assert.equal(PUBLIC_QUEUE_POLL_MS, 8000)
  })
})
