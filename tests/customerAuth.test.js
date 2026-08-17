import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyIdentifier,
  classifyPhPlate,
  isValidCustomerPlate,
  normalizePlate,
  phoneLoginEmail,
  plateKindLabel,
  plateValidationError,
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
    assert.equal(classifyIdentifier('AAA'), 'unknown')
  })

  it('normalizes plates and resolves email/phone login', () => {
    assert.equal(normalizePlate('COND.8821'), 'COND8821')
    assert.equal(normalizePlate('TMP 1234'), 'TMP1234')
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

  it('accepts LTO, conduction stickers, and temporary / TOP numbers', () => {
    assert.equal(classifyPhPlate('ABC 1234'), 'lto')
    assert.equal(classifyPhPlate('ABC 123'), 'lto')
    assert.equal(classifyPhPlate('AB 12345'), 'lto')
    assert.equal(classifyPhPlate('MC 1234'), 'lto')
    assert.equal(classifyPhPlate('847291'), 'conduction')
    assert.equal(classifyPhPlate('CS 123456'), 'conduction')
    assert.equal(classifyPhPlate('COND-8821'), 'conduction')
    assert.equal(classifyPhPlate('TMP 1234'), 'temporary')
    assert.equal(classifyPhPlate('TEMP-8821'), 'temporary')
    assert.equal(classifyPhPlate('TP 12345'), 'temporary')
    assert.equal(classifyPhPlate('TOP 7788'), 'temporary')
    assert.equal(isValidCustomerPlate('847291'), true)
    assert.equal(isValidCustomerPlate('TMP 1234'), true)
    assert.equal(isValidCustomerPlate('09171234567'), false)
    assert.equal(plateKindLabel('CS 123456'), 'Conduction sticker')
    assert.equal(plateKindLabel('TMP 1234'), 'Temporary / TOP')
    assert.match(plateValidationError('AAA'), /numbers/i)
    assert.match(plateValidationError('09171234567'), /phone/i)
    assert.equal(plateValidationError('ABC 1234'), null)
    assert.equal(plateValidationError('847291'), null)
  })

  it('classifies digit-only conduction as a plate, not a phone', () => {
    assert.equal(classifyIdentifier('847291'), 'plate')
    assert.equal(classifyIdentifier('09171234567'), 'phone')
  })

  it('only keeps http(s) vehicle photo URLs', () => {
    assert.equal(safeVehiclePhotoUrl('https://cdn.example.com/car.jpg'), 'https://cdn.example.com/car.jpg')
    assert.equal(safeVehiclePhotoUrl('javascript:alert(1)'), null)
    assert.equal(safeVehiclePhotoUrl(''), null)
  })
})
