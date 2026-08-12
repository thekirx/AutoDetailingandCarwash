import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DETAILING_FLOOR_LIVE_STATUSES,
  WASH_FLOOR_LIVE_STATUSES,
  floorLaneLabel,
  splitFloorBoardLanes,
} from '../src/lib/floorBoardLanes.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('floor board lanes by family', () => {
  it('names wash lanes as Services & Packages statuses', () => {
    assert.equal(floorLaneLabel('waiting', 'wash'), 'Waiting')
    assert.equal(floorLaneLabel('in_progress', 'wash'), 'In Progress')
    assert.equal(floorLaneLabel('final_checking', 'wash'), 'Final Checking')
    assert.equal(floorLaneLabel('for_payment', 'wash'), 'For Payment')
    assert.equal(floorLaneLabel('completed', 'wash'), 'Completed')
    assert.equal(floorLaneLabel('cancelled', 'wash'), 'Cancelled')
  })

  it('names detailing lanes with the detailing pipeline labels', () => {
    assert.equal(floorLaneLabel('confirmed', 'detailing'), 'Assign to branch')
    assert.equal(floorLaneLabel('waiting', 'detailing'), 'Vehicle intake')
    assert.equal(floorLaneLabel('in_progress', 'detailing'), 'In progress')
    assert.equal(floorLaneLabel('final_checking', 'detailing'), 'Final checking')
    assert.equal(floorLaneLabel('for_releasing', 'detailing'), 'For releasing')
    assert.equal(floorLaneLabel('completed', 'detailing'), 'Completed')
    assert.equal(floorLaneLabel('cancelled', 'detailing'), 'Cancelled')
  })

  it('splits live and timeline counts into services/packages vs detailing', () => {
    const activeQueue = [
      { booking_id: 'w1', status: 'waiting', service_pay_category: 'wash' },
      { booking_id: 'p1', status: 'in_progress', service_pay_category: 'package' },
      { booking_id: 'd1', status: 'waiting', service_pay_category: 'detailing' },
      { booking_id: 'd2', status: 'confirmed', service_pay_category: 'detailing' },
      { booking_id: 'd3', status: 'final_checking', service_pay_category: 'detailing' },
    ]
    const periodJobs = [
      { booking_id: 'wc', status: 'completed', service_pay_category: 'general' },
      { booking_id: 'dc', status: 'completed', service_pay_category: 'detailing' },
      { booking_id: 'dx', status: 'cancelled', service_pay_category: 'detailing' },
    ]

    const split = splitFloorBoardLanes({ activeQueue, periodJobs })

    assert.deepEqual(WASH_FLOOR_LIVE_STATUSES, [
      'waiting',
      'in_progress',
      'final_checking',
      'for_payment',
    ])
    assert.ok(DETAILING_FLOOR_LIVE_STATUSES.includes('confirmed'))
    assert.equal(split.wash.waiting, 1)
    assert.equal(split.wash.in_progress, 1)
    assert.equal(split.wash.final_checking, 0)
    assert.equal(split.wash.completed, 1)
    assert.equal(split.wash.cancelled, 0)
    assert.equal(split.detailing.confirmed, 1)
    assert.equal(split.detailing.waiting, 1)
    assert.equal(split.detailing.final_checking, 1)
    assert.equal(split.detailing.completed, 1)
    assert.equal(split.detailing.cancelled, 1)
  })

  it('Floor Board UI separates Services & Packages from Detailing Services', () => {
    const board = readFileSync(join(root, 'src/pages/SuperAdminFloorBoard.jsx'), 'utf8')
    const api = readFileSync(join(root, 'src/queue/queueApi.js'), 'utf8')
    const labels = readFileSync(join(root, 'src/lib/floorBoardLanes.js'), 'utf8')
    assert.match(board, /Services & Packages/)
    assert.match(board, /Detailing Services/)
    assert.match(board, /laneCountsByFamily/)
    assert.match(board, /Floor Board/)
    assert.match(board, /floorLaneLabel/)
    assert.match(board, /LaneStrip family="wash"/)
    assert.match(board, /LaneStrip family="detailing"/)
    assert.match(labels, /detailingBoardStatusLabel/)
    assert.match(labels, /Services & Packages/)
    assert.match(labels, /Detailing Services/)
    assert.equal(floorLaneLabel('confirmed', 'detailing'), 'Assign to branch')
    assert.equal(floorLaneLabel('waiting', 'detailing'), 'Vehicle intake')
    assert.match(api, /family:\s*['"]detailing['"]/)
    assert.match(api, /laneCountsByFamily/)
  })
})
