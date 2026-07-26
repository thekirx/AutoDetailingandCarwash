/**
 * Assert PH vehicle catalog helpers (plate autofill support logic).
 * Run: node --input-type=module tests/phVehicles.test.js
 */
import assert from 'node:assert/strict'
import {
  filterVehicleMakes,
  filterVehicleModels,
  flattenVehicleCatalog,
  modelsForMake,
  splitCustomerName,
  PH_VEHICLE_MAKES,
} from '../src/lib/phVehicles.js'

assert.ok(PH_VEHICLE_MAKES.includes('Toyota'))
assert.ok(PH_VEHICLE_MAKES.includes('Mitsubishi'))
assert.ok(PH_VEHICLE_MAKES.includes('BYD'))
assert.ok(PH_VEHICLE_MAKES.length >= 35, `expected ≥35 makes, got ${PH_VEHICLE_MAKES.length}`)
const flat = flattenVehicleCatalog()
assert.ok(flat.length >= 400, `expected ≥400 make/model pairs, got ${flat.length}`)
assert.ok(modelsForMake('Toyota').includes('Fortuner'))
assert.ok(modelsForMake('toyota').includes('Vios')) // case-insensitive make
assert.ok(modelsForMake('Isuzu').includes('D-Max'))
assert.deepEqual(filterVehicleMakes('toy').slice(0, 1), ['Toyota'])
assert.ok(filterVehicleModels('Honda', 'cr').some((m) => /CR-V/i.test(m)))
assert.deepEqual(splitCustomerName('Juan Dela Cruz'), { first: 'Juan', last: 'Dela Cruz' })
assert.deepEqual(splitCustomerName('Maria'), { first: 'Maria', last: '' })
assert.equal(modelsForMake('NotABrand').length, 0)

console.log(`phVehicles catalog: ok (${PH_VEHICLE_MAKES.length} makes, ${flat.length} pairs)`)
