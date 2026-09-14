/**
 * vehicle_catalog helpers — must match Super Admin Cars (active rows → picker map).
 * Run: node --input-type=module tests/vehicleCatalog.test.js
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  catalogMakes,
  catalogRowsToMap,
  catalogRowsToSizeIndex,
  catalogSizeFor,
  filterCatalogMakes,
  filterCatalogModels,
  modelsForCatalogMake,
  resolveCatalogMake,
} from '../src/lib/vehicleCatalog.js'

const rows = [
  { make: 'Toyota', model: 'Vios' },
  { make: 'Toyota', model: 'Fortuner' },
  { make: 'BYD', model: 'Atto 3' },
  { make: 'Audi', model: 'A3' },
  { make: '', model: 'Ghost' },
]

const map = catalogRowsToMap(rows)
assert.deepEqual(catalogMakes(map), ['Audi', 'BYD', 'Toyota'])
assert.equal(resolveCatalogMake(map, 'toyota'), 'Toyota')
assert.equal(resolveCatalogMake(map, 'TOYOTA'), 'Toyota')
assert.equal(resolveCatalogMake(map, 'NoSuch'), null)
assert.deepEqual(modelsForCatalogMake(map, 'toyota'), ['Vios', 'Fortuner'])
assert.deepEqual(filterCatalogMakes(map, 'by'), ['BYD'])
assert.ok(filterCatalogMakes(map, '', 2).length === 2)
assert.deepEqual(filterCatalogModels(map, 'Toyota', 'for'), ['Fortuner'])
assert.equal(filterCatalogModels(map, '', '').length, 0)

const sized = catalogRowsToSizeIndex([
  { make: 'Toyota', model: 'Vios', size_slug: 'small' },
  { make: 'Toyota', model: 'Fortuner' },
])
assert.equal(catalogSizeFor(sized, 'toyota', 'vios'), 'small')
assert.equal(catalogSizeFor(sized, 'Toyota', 'Fortuner'), 'large')
assert.equal(catalogSizeFor(null, 'Toyota', 'Alphard'), 'extra_large')

const pickerSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/VehicleMakeModelFields.jsx'),
  'utf8',
)
assert.ok(!pickerSrc.includes('phVehicles'), 'picker must not fall back to static phVehicles')
assert.match(pickerSrc, /vehicle_catalog/)
assert.match(pickerSrc, /is_active/)
assert.match(pickerSrc, /size_slug/)
assert.match(pickerSrc, /onSizeSuggest/)

console.log('vehicleCatalog helpers: ok')
