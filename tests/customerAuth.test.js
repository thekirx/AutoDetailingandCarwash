import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { phoneLoginEmail } from '../src/lib/customerAuth.js'
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
