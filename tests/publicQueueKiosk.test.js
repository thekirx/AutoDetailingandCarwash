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
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')

describe('public queue kiosk modes', () => {
  it('adds public_queue_floor with plate + service, no phone/name', () => {
    assert.match(migration, /public_queue_floor/)
    assert.match(migration, /vehicle_plate/)
    assert.match(migration, /service_name/)
    assert.match(migration, /service_pay_category/)
    assert.doesNotMatch(migration, /customer_phone/)
    assert.doesNotMatch(migration, /customer_name/)
  })

  it('wires customer and shop TV routes', () => {
    assert.match(app, /\/queue\/:branch\/tv/)
    assert.match(page, /mode === 'tv'|mode = 'tv'|mode="tv"/)
    assert.match(page, /public_queue_counts/)
    assert.match(page, /public_queue_floor/)
    assert.match(page, /counts only|Customer view|Shop TV/i)
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
