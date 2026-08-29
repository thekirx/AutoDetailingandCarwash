import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'src/pages/SuperAdminFloorBoard.jsx'), 'utf8')
const api = readFileSync(join(root, 'src/queue/queueApi.js'), 'utf8')

describe('floor board owner feedback cuts', () => {
  it('has no total sales tile or total waiting label', () => {
    assert.doesNotMatch(src, /label=["']Total sales["']/i)
    assert.doesNotMatch(src, /Total waiting time/i)
  })

  it('uses avg waiting + paid sales labels', () => {
    assert.match(src, /Avg waiting time/)
    assert.match(src, /Paid sales/)
    assert.match(api, /avg_wait_minutes/)
    assert.match(api, /averageWaitMinutes/)
  })

  it('removed job details section', () => {
    assert.doesNotMatch(src, /title=["']Job details["']/)
    assert.doesNotMatch(src, /setJobFilter/)
    assert.doesNotMatch(src, /QueueTicketEditModal/)
  })

  it('keeps sales feed and drops detailing-ops cancelled tile', () => {
    assert.match(src, /Sales feed/)
    assert.match(src, /recentSales/)
    assert.doesNotMatch(
      src,
      /label=["']Cancelled["'][\s\S]{0,200}openHistory\(['"]cancelled['"]\)/,
    )
  })

  it('documents insights and chemical logic for the owner', () => {
    assert.match(src, /each paid sale in the timeline counts once by booking vehicle size/)
    assert.match(src, /ranks sale line items for paid sales/)
    assert.match(src, /Usage = previous/)
    assert.match(src, /formatCarSizeLabel/)
    assert.match(src, /wait_sample_n|No wait stamps in timeline/)
  })

  it('exposes KPI sample counts and best-seller fallback in API', () => {
    assert.match(api, /wait_sample_n/)
    assert.match(api, /cycle_sample_n/)
    assert.match(api, /saleLinesFromBookingServices/)
  })
})
