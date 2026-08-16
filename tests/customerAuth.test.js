import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyIdentifier,
  isValidCustomerPlate,
  normalizePlate,
  phoneLoginEmail,
  resolveLoginEmail,
  safeVehiclePhotoUrl,
} from '../src/lib/customerAuth.js'
import { phoneLoginEmail as serverPhoneLoginEmail } from '../server/provisionCustomer.mjs'

describe('customer account login email', () => {
  it('maps PH mobile to one canonical synthetic login email', () => {
    const expected = 'c09171234567@customers.hakumautocare.com'
    assert.equal(phoneLoginEmail('0917-123-4567'), expected)
    assert.equal(serverPhoneLoginEmail('+63 917 123 4567'), expected)
  })

  it('rejects short phones', () => {
    assert.throws(() => phoneLoginEmail('123'), /valid phone/)
  })
})

describe('customer identifier classification', () => {
  it('detects email, phone, and plate', () => {
    assert.equal(classifyIdentifier('you@email.com'), 'email')
    assert.equal(classifyIdentifier('09171234567'), 'phone')
    assert.equal(classifyIdentifier('ABC 1234'), 'plate')
    assert.equal(classifyIdentifier('abc-1234'), 'plate')
  })

  it('normalizes plates and resolves email/phone login', () => {
    assert.equal(normalizePlate('ab c-12'), 'ABC12')
    assert.equal(resolveLoginEmail('You@Hakum.com'), 'you@hakum.com')
    assert.equal(resolveLoginEmail('0917 123 4567'), 'c09171234567@customers.hakumautocare.com')
    assert.throws(() => resolveLoginEmail('ABC1234'), /plate lookup/)
  })

  it('accepts PH plates with letters and numbers', () => {
    assert.equal(isValidCustomerPlate('ABC 1234'), true)
    assert.equal(isValidCustomerPlate('WASH-88'), true)
    assert.equal(isValidCustomerPlate('AAA'), false)
    assert.equal(isValidCustomerPlate('12'), false)
    assert.equal(isValidCustomerPlate(''), false)
  })

  it('only keeps http(s) vehicle photo URLs', () => {
    assert.equal(safeVehiclePhotoUrl('https://cdn.example.com/car.jpg'), 'https://cdn.example.com/car.jpg')
    assert.equal(safeVehiclePhotoUrl('javascript:alert(1)'), null)
    assert.equal(safeVehiclePhotoUrl(''), null)
  })
})
