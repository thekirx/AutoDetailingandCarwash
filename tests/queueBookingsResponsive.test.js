import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isOpenBookingStatus } from '../src/lib/detailingBoardStatuses.js'
import { statusShortLabel } from '../src/queue/queueLogic.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('open bookings + queue one-screen board', () => {
  it('open pipeline statuses stay visible until completed/cancelled', () => {
    assert.equal(isOpenBookingStatus('pending'), true)
    assert.equal(isOpenBookingStatus('waiting'), true)
    assert.equal(isOpenBookingStatus('final_checking'), true)
    assert.equal(isOpenBookingStatus('completed'), false)
    assert.equal(isOpenBookingStatus('cancelled'), false)
  })

  it('queue short labels fit dense boards', () => {
    assert.equal(statusShortLabel('confirmed'), 'Assigned')
    assert.equal(statusShortLabel('waiting'), 'In Take')
    assert.equal(statusShortLabel('final_checking'), 'Ready')
  })

  it('queue page uses chip list on small screens and fitted board on xl', () => {
    const page = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    assert.match(page, /queue-card-list mt-3 xl:hidden/)
    assert.match(page, /queue-lane-board-fit/)
    assert.match(page, /statusShortLabel/)
    assert.match(css, /\.queue-lane-board-fit\s*\{/)
  })
})
