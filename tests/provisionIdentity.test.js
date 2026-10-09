import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveCustomerIdentity } from '../server/provisionCustomer.mjs'

const ana = { id: 'a', full_name: 'Ana Cruz' }
const ben = { id: 'b', full_name: 'Ben Santos' }

describe('POS customer identity (phone + email are unique)', () => {
  it('returns nobody when both identifiers are free', () => {
    assert.equal(resolveCustomerIdentity({ byPhone: null, byEmail: null }), null)
  })

  it('reuses the one customer that owns the phone or the email', () => {
    assert.equal(resolveCustomerIdentity({ byPhone: ana, byEmail: null }), ana)
    assert.equal(resolveCustomerIdentity({ byPhone: null, byEmail: ana }), ana)
    assert.equal(resolveCustomerIdentity({ byPhone: ana, byEmail: ana }), ana)
  })

  it('refuses when phone and email belong to different customers', () => {
    assert.throws(
      () => resolveCustomerIdentity({ byPhone: ana, byEmail: ben }),
      (err) => err.status === 409 && /Ana Cruz/.test(err.message) && /Ben Santos/.test(err.message),
    )
  })

  it('refuses when a pinned customer would collide with someone else', () => {
    assert.throws(() => resolveCustomerIdentity({ byPhone: ben, byEmail: null, pinnedId: 'a' }), (err) => err.status === 409)
    assert.equal(resolveCustomerIdentity({ byPhone: ana, byEmail: null, pinnedId: 'a' }), ana)
  })
})
