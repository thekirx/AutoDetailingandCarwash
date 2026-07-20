import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyIdentifier,
  normalizePlate,
  phoneLoginEmail,
  resolveLoginEmail,
} from '../src/lib/customerAuth.js'
import { phoneLoginEmail as serverPhoneLoginEmail } from '../server/provisionCustomer.mjs'

describe('customer account login email', () => {
  it('maps PH mobile to synthetic login email', () => {
    assert.equal(phoneLoginEmail('0917-123-4567'), 'c09171234567@customers.hakumautocare.com')
    assert.equal(serverPhoneLoginEmail('+63 917 123 4567'), 'c639171234567@customers.hakumautocare.com')
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
})
