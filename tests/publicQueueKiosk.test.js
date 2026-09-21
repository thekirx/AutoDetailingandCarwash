import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPublicFloorModel } from '../src/queue/queueLogic.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migration = readFileSync(
  join(root, 'supabase/migrations/20260808140000_public_queue_floor_kiosk.sql'),
  'utf8',
)
const page = readFileSync(join(root, 'src/pages/PublicQueuePage.jsx'), 'utf8')
const tvPage = readFileSync(join(root, 'src/pages/PublicQueueTvPage.jsx'), 'utf8')
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const tvMigration = readFileSync(
  join(root, 'supabase/migrations/20260921100000_public_queue_tv_floor.sql'),
  'utf8',
)

describe('public queue kiosk modes', () => {
  it('adds public_queue_floor with plate + service, no phone/name', () => {
    assert.match(migration, /public_queue_floor/)
    assert.match(migration, /vehicle_plate/)
    assert.match(migration, /service_name/)
    assert.match(migration, /service_pay_category/)
    assert.doesNotMatch(migration, /customer_phone/)
    assert.doesNotMatch(migration, /customer_name/)
  })

  it('shop TV view adds car + crew + payment lanes without PII', () => {
    assert.match(tvMigration, /vehicle_make/)
    assert.match(tvMigration, /crew_names/)
    assert.match(tvMigration, /for_payment/)
    assert.match(tvMigration, /for_releasing/)
    assert.doesNotMatch(tvMigration, /customer_phone/)
    assert.doesNotMatch(tvMigration, /customer_name/)
  })

  it('wires customer and shop TV routes', () => {
    assert.match(app, /\/queue\/:branch\/tv/)
    assert.match(app, /PublicQueueTvPage/)
    assert.match(page, /public_queue_counts/)
    assert.match(tvPage, /public_queue_floor/)
    assert.match(tvPage, /PUBLIC_TV_POLL_MS/)
    assert.match(tvPage, /TV_BOARD_LANES/)
    assert.match(tvPage, /buildPublicTvBoardModel/)
    assert.match(tvPage, /fetchPublicBranches/)
    assert.match(tvPage, /mode: 'visible'/)
    assert.doesNotMatch(tvPage, /fallbackSlug/)
    assert.doesNotMatch(tvPage, /useAuth/)
    assert.doesNotMatch(tvPage, /customer_phone|customer_name/)
    assert.doesNotMatch(tvPage, /from\('bookings'\)/)
  })

  it('builds floor model with plate and kind labels', () => {
    const model = buildPublicFloorModel(
      [
        {
          branch: 'bacoor',
          queue_number: 3,
          status: 'waiting',
          vehicle_plate: 'abc 1234',
          service_name: 'Ceramic Package',
          service_pay_category: 'package',
        },
        {
          branch: 'bacoor',
          queue_number: 1,
          status: 'in_progress',
          vehicle_plate: 'XYZ999',
          service_name: 'Full Interior',
          service_pay_category: 'detailing',
        },
      ],
      'bacoor',
    )
    assert.equal(model.groups.waiting[0].plate, 'ABC 1234')
    assert.equal(model.groups.waiting[0].kindLabel, 'Package')
    assert.equal(model.groups.in_progress[0].kindLabel, 'Detailing')
    assert.match(model.groups.in_progress[0].queueNumber, /^D-/)
  })
})
