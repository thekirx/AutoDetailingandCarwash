import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CUSTOMER_QUEUE_PATH,
  PUBLIC_QUEUE_POLL_MS,
  absolutePublicUrl,
  branchLaunchGuide,
  branchQueueTotal,
  customerQueuePath,
  liveQueuePath,
  queueCountsFromRow,
  shopTvPath,
} from '../src/lib/liveQueuePath.js'

describe('live queue paths', () => {
  it('keeps public kiosk paths on /queue', () => {
    assert.equal(liveQueuePath('bacoor'), '/queue/bacoor')
    assert.equal(liveQueuePath(''), '/queue')
    assert.equal(shopTvPath('imus'), '/queue/imus/tv')
    assert.equal(shopTvPath('hakum south'), '/queue/hakum%20south/tv')
    assert.equal(shopTvPath(''), '/queue')
    assert.equal(absolutePublicUrl('/queue/imus/tv', 'https://hakum.example'), 'https://hakum.example/queue/imus/tv')
  })

  it('builds a skippable launch guide from the slug alone', () => {
    const live = branchLaunchGuide({ slug: 'imus', name: 'Hakum Auto Care Imus', status: 'active' })
    assert.equal(live.tvPath, '/queue/imus/tv')
    assert.equal(live.customerPath, '/queue/imus')
    assert.equal(live.live, true)
    assert.ok(live.steps.some((s) => s.id === 'tv' && s.ready && s.copyPath === '/queue/imus/tv'))
    assert.ok(live.steps.some((s) => s.id === 'people' && !s.ready))
    const soon = branchLaunchGuide({ slug: 'silang', name: 'Silang', status: 'coming_soon' })
    assert.equal(soon.live, false)
    assert.equal(soon.tvPath, '/queue/silang/tv')
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

  it('uses every active vehicle for the homepage branch total', () => {
    assert.equal(
      branchQueueTotal({
        waiting_count: 2,
        in_progress_count: 3,
        final_checking_count: 1,
        total_active_count: 7,
      }),
      7,
    )
    assert.equal(branchQueueTotal(null), 0)
  })
})
