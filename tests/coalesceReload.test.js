import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCoalescedReload, createTtlCache } from '../src/lib/coalesceReload.js'

describe('coalesceReload', () => {
  it('collapses burst triggers into one run after debounce', async () => {
    let runs = 0
    const reload = createCoalescedReload(async () => {
      runs += 1
    }, 30)
    reload()
    reload()
    reload()
    await new Promise((r) => setTimeout(r, 80))
    assert.equal(runs, 1)
    reload.cancel()
  })

  it('queues a follow-up when events arrive during an in-flight load', async () => {
    let runs = 0
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const reload = createCoalescedReload(async () => {
      runs += 1
      if (runs === 1) await gate
    }, 10)
    reload()
    await new Promise((r) => setTimeout(r, 25))
    assert.equal(runs, 1)
    reload()
    release()
    await new Promise((r) => setTimeout(r, 50))
    assert.equal(runs, 2)
    reload.cancel()
  })

  it('ttl cache expires', async () => {
    const cache = createTtlCache(20)
    cache.set('ok')
    assert.equal(cache.get(), 'ok')
    await new Promise((r) => setTimeout(r, 35))
    assert.equal(cache.get(), undefined)
  })
})
