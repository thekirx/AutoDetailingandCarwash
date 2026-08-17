import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { prepareGaragePlateChange } from '../src/lib/customerGarage.js'

describe('customer garage plate change', () => {
  it('rejects an invalid next plate', () => {
    const result = prepareGaragePlateChange({
      vehicleId: 'v1',
      currentPlate: 'ABC 1234',
      nextPlate: 'AAA',
    })
    assert.equal(result.ok, false)
    assert.match(result.error, /numbers|plate|sticker/i)
  })

  it('rejects a plate already on another vehicle', () => {
    const result = prepareGaragePlateChange({
      vehicleId: 'v1',
      currentPlate: '847291',
      nextPlate: 'ABC 1234',
      occupantVehicleId: 'v2',
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 409)
  })

  it('allows changing a conduction sticker to an LTO plate on the same car', () => {
    const result = prepareGaragePlateChange({
      vehicleId: 'v1',
      currentPlate: '847291',
      nextPlate: 'ABC 1234',
      occupantVehicleId: 'v1',
    })
    assert.equal(result.ok, true)
    assert.equal(result.plateChanged, true)
    assert.equal(result.normalized_plate_number, 'ABC1234')
    assert.equal(result.plate_number, 'ABC 1234')
  })
})

describe('garage UI + portal', () => {
  it('lets a customer add a car and change its plate', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const read = (p) => readFileSync(join(root, p), 'utf8')
    assert.match(read('server/customerPortal.mjs'), /update-vehicle/)
    assert.match(read('src/components/CustomerSettingsModal.jsx'), /update-vehicle/)
    assert.match(read('src/pages/CustomerAccountPage.jsx'), /Change plate/)
  })
})
