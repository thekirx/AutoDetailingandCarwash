import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isWalkInCustomerName,
  mergeCustomerDisplayName,
  resolveQueueCustomerDisplayName,
  validateQueueTicketIdentity,
} from '../src/lib/queueCustomerName.js'

describe('queueCustomerName', () => {
  it('uses typed name when present', () => {
    assert.equal(
      resolveQueueCustomerDisplayName({
        customer_first_name: 'Ana',
        customer_last_name: 'Cruz',
        vehicle_plate: 'ABC 1234',
        customer_phone: '09171234567',
      }),
      'Ana Cruz',
    )
  })

  it('falls back to Walk-in · plate when name omitted', () => {
    assert.equal(
      resolveQueueCustomerDisplayName({
        vehicle_plate: 'abc-1234',
        customer_phone: '09171234567',
      }),
      'Walk-in · ABC1234',
    )
    assert.equal(isWalkInCustomerName('Walk-in · ABC1234'), true)
    assert.equal(isWalkInCustomerName('Ana Cruz'), false)
  })

  it('does not clobber a real CRM name with walk-in label', () => {
    assert.equal(
      mergeCustomerDisplayName('Walk-in · ABC1234', 'Ana Cruz'),
      'Ana Cruz',
    )
    assert.equal(
      mergeCustomerDisplayName('Ben Santos', 'Walk-in · ABC1234'),
      'Ben Santos',
    )
  })

  it('requires phone, plate, and at least one catalog item', () => {
    assert.match(
      validateQueueTicketIdentity({ customer_phone: '0917', vehicle_plate: 'ABC', service_ids: ['1'] }),
      /Phone/,
    )
    assert.match(
      validateQueueTicketIdentity({ customer_phone: '09171234567', vehicle_plate: '', service_ids: ['1'] }),
      /Plate/,
    )
    assert.match(
      validateQueueTicketIdentity({ customer_phone: '09171234567', vehicle_plate: 'ABC 1234', service_ids: [] }),
      /service/,
    )
    assert.equal(
      validateQueueTicketIdentity({
        customer_phone: '09171234567',
        vehicle_plate: 'ABC 1234',
        service_ids: ['svc-1'],
      }),
      null,
    )
  })
})
