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
    assert.equal(statusShortLabel('confirmed'), 'Confirmed')
    assert.equal(statusShortLabel('waiting'), 'Waiting')
    assert.equal(statusShortLabel('final_checking'), 'Final check')
  })

  it('queue board follows the pane, pages each lane, and has a ledger table', () => {
    const page = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    assert.match(page, /className="queue-board/)
    assert.match(page, /title="Queue"/)
    assert.match(page, /queue-lane-board-fit/)
    assert.match(page, /statusShortLabel/)
    assert.match(page, /QUEUE_LANE_PAGE_SIZE/)
    assert.match(page, /paginateRows/)
    assert.match(page, /queue-lane-pager/)
    assert.match(page, /view === 'table'/)
    assert.match(page, /className="bk-table"/)
    assert.match(page, /bk-data-grid/)
    assert.match(page, /q-col-service/)
    assert.match(page, /queue-seg/)
    assert.doesNotMatch(page, /queue-card-list/)
    assert.doesNotMatch(page, /hidden xl:grid/)
    assert.match(css, /\.queue-board\s*\{[^}]*container-name:\s*q-board/s)
    assert.match(css, /@container q-board/)
    assert.match(css, /\.queue-lane-board-fit\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
    assert.match(css, /@container q-board \(min-width: 44rem\)[\s\S]*overflow-x:\s*auto/)
    assert.match(css, /\.q-col-service[\s\S]*display:\s*none/)
    assert.match(css, /\.queue-lane-dimmed[\s\S]*display:\s*none/)
  })
})
