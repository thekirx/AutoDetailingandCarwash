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

  it('uses avg waiting and drops paid-sales count tile', () => {
    assert.match(src, /Avg waiting time/)
    assert.doesNotMatch(src, /label=["']Paid sales["']/)
    assert.match(api, /avg_wait_minutes/)
    assert.match(api, /averageWaitMinutes/)
  })

  it('removed job details section', () => {
    assert.doesNotMatch(src, /title=["']Job details["']/)
    assert.doesNotMatch(src, /setJobFilter/)
    assert.doesNotMatch(src, /QueueTicketEditModal/)
  })

  it('drops sales feed and detailing-ops cancelled tile', () => {
    assert.doesNotMatch(src, /Sales feed/)
    assert.doesNotMatch(src, /title=["']Chemical usage["']/)
    assert.doesNotMatch(src, /Absent \/ not checked in/)
    assert.doesNotMatch(src, /No free crew on site/)
    assert.doesNotMatch(
      src,
      /label=["']Cancelled["'][\s\S]{0,200}openHistory\(['"]cancelled['"]\)/,
    )
  })

  it('documents car-size insights for the owner', () => {
    assert.match(src, /each paid sale in the timeline counts once by booking vehicle size/)
    assert.match(src, /ranks sale line items/)
    assert.match(src, /formatCarSizeLabel/)
    assert.match(src, /wait_sample_n|No wait stamps in timeline/)
  })

  it('exposes KPI sample counts and best-seller fallback in API', () => {
    assert.match(api, /wait_sample_n/)
    assert.match(api, /cycle_sample_n/)
    assert.match(api, /saleLinesFromBookingServices/)
    assert.match(api, /uniqueBookingsById/)
  })

  it('StatTile hover preview + click opens breakdown dialog', () => {
    assert.match(src, /function StatTile/)
    assert.match(src, /createPortal/)
    assert.match(src, /Click for full breakdown/)
    assert.match(src, /DialogContent/)
    assert.match(src, /aria-haspopup=["']dialog["']/)
    assert.match(src, /onMouseEnter=\{placeTip\}/)
    assert.match(src, /label=["']Avg waiting time["'][\s\S]*?breakdown=/)
    assert.match(src, /label=["']Failed QA["'][\s\S]*?breakdown=/)
    assert.match(src, /label=["']Cash["'][\s\S]*?breakdown=/)
    assert.match(src, /Open related view/)
  })
})
