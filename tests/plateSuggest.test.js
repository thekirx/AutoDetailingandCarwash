import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  applyPlateSuggestion,
  plateSuggestPrefix,
  rankPlateSuggestions,
} from '../src/lib/plateSuggest.js'

const garage = [
  {
    id: 'v1',
    vehicle_id: 'v1',
    plate_number: 'ABC 1234',
    normalized_plate_number: 'ABC1234',
    customer_name: 'Ana Cruz',
    customer_phone: '09171234567',
    vehicle_make: 'Toyota',
    vehicle_model: 'Vios',
    vehicle_type: 'small',
    vehicle_year: '2020',
    vehicle_color: 'White',
  },
  {
    id: 'v2',
    vehicle_id: 'v2',
    plate_number: 'ABC 5678',
    normalized_plate_number: 'ABC5678',
    customer_name: 'Ben Santos',
    customer_phone: '09170001111',
    vehicle_make: 'Honda',
    vehicle_model: 'City',
  },
  {
    id: 'v3',
    vehicle_id: 'v3',
    plate_number: '847291',
    normalized_plate_number: '847291',
    customer_name: 'Walk-in',
    vehicle_make: 'Mitsubishi',
    vehicle_model: 'Mirage',
  },
]

describe('plate typeahead', () => {
  it('waits until 3 characters before suggesting', () => {
    assert.equal(plateSuggestPrefix(''), '')
    assert.equal(plateSuggestPrefix('AB'), '')
    assert.equal(plateSuggestPrefix('A B'), '')
    assert.equal(plateSuggestPrefix('ABC'), 'ABC')
    assert.equal(plateSuggestPrefix('abc 1'), 'ABC1')
    assert.equal(plateSuggestPrefix('847'), '847')
  })

  it('does not treat a phone number as a plate prefix', () => {
    assert.equal(plateSuggestPrefix('09171234567'), '')
  })

  it('lists matching plates after the first 3 characters', () => {
    assert.deepEqual(
      rankPlateSuggestions(garage, 'ABC').map((row) => row.plate_number),
      ['ABC 1234', 'ABC 5678'],
    )
    assert.deepEqual(
      rankPlateSuggestions(garage, '847').map((row) => row.plate_number),
      ['847291'],
    )
    assert.deepEqual(rankPlateSuggestions(garage, 'AB'), [])
  })

  it('fills ticket identity from a picked plate', () => {
    const next = applyPlateSuggestion(
      { customer_first_name: '', customer_last_name: '', vehicle_plate: 'ABC', vehicle_make: '' },
      garage[0],
    )
    assert.equal(next.vehicle_plate, 'ABC 1234')
    assert.equal(next.customer_first_name, 'Ana')
    assert.equal(next.customer_last_name, 'Cruz')
    assert.equal(next.customer_phone, '09171234567')
    assert.equal(next.vehicle_make, 'Toyota')
    assert.equal(next.vehicle_model, 'Vios')
    assert.equal(next.vehicle_id, 'v1')
  })
})

describe('plate typeahead wiring', () => {
  it('Team Lead ticket form searches plates after 3 characters', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    assert.match(src, /searchPlates/)
    assert.match(src, /plateSuggestPrefix/)
    assert.match(src, /plateSuggestions/)
  })
})
