/**
 * Assert PH vehicle catalog helpers (plate autofill support logic).
 * Run: node --input-type=module tests/phVehicles.test.js
 */
import assert from 'node:assert/strict'
import {
  filterVehicleMakes,
  filterVehicleModels,
  modelsForMake,
  splitCustomerName,
  PH_VEHICLE_MAKES,
} from '../src/lib/phVehicles.js'

assert.ok(PH_VEHICLE_MAKES.includes('Toyota'))
assert.ok(PH_VEHICLE_MAKES.includes('Mitsubishi'))
assert.ok(modelsForMake('Toyota').includes('Fortuner'))
assert.ok(modelsForMake('toyota').includes('Vios')) // case-insensitive make
assert.deepEqual(filterVehicleMakes('toy').slice(0, 1), ['Toyota'])
assert.ok(filterVehicleModels('Honda', 'cr').some((m) => /CR-V/i.test(m)))
assert.deepEqual(splitCustomerName('Juan Dela Cruz'), { first: 'Juan', last: 'Dela Cruz' })
assert.deepEqual(splitCustomerName('Maria'), { first: 'Maria', last: '' })
assert.equal(modelsForMake('NotABrand').length, 0)

console.log('phVehicles catalog: ok')
