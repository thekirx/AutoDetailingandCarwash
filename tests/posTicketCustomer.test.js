import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  customerFormError,
  customerFormValues,
  hasCustomerInput,
  ticketFormValues,
  ticketNeedsCustomer,
} from '../src/lib/posTicketCustomer.js'

describe('POS ticket customer capture', () => {
  it('flags tickets with no customer or only a walk-in placeholder', () => {
    assert.equal(ticketNeedsCustomer({ customer_id: null, customer_name: 'Walk-in · ABC1234' }), true)
    assert.equal(ticketNeedsCustomer({ customer_id: 'c1', customer_name: 'Walk-in · ABC1234' }), true)
    assert.equal(ticketNeedsCustomer({ customer_id: 'c1', customer_name: 'Ben Santos' }), false)
    assert.equal(ticketNeedsCustomer(null), false)
  })

  it('prefills from legacy ticket contact but never from a placeholder name', () => {
    assert.deepEqual(
      ticketFormValues({ customer_name: 'Walk-in · ABC1234', customer_phone: '09171234567', customer_email: '' }),
      { first: '', last: '', phone: '09171234567', email: '' },
    )
    assert.deepEqual(
      ticketFormValues({ customer_name: 'Ben Santos', customer_phone: '', customer_email: 'b@x.com' }),
      { first: 'Ben', last: 'Santos', phone: '', email: 'b@x.com' },
    )
  })

  it('autofills first/last from a customer row, splitting full_name when needed', () => {
    assert.deepEqual(customerFormValues({ full_name: 'Ana Maria Cruz', phone: '0917', email: 'a@x.com' }), {
      first: 'Ana',
      last: 'Maria Cruz',
      phone: '0917',
      email: 'a@x.com',
    })
    assert.deepEqual(customerFormValues({ first_name: 'Ana', last_name: '', full_name: 'Ana', phone: '', email: '' }).first, 'Ana')
  })

  it('blank is a guest sale; a new account needs a mobile and a first name', () => {
    assert.equal(hasCustomerInput({}), false)
    assert.equal(customerFormError({}), '')
    assert.match(customerFormError({ phone: '0917' }), /valid mobile/)
    assert.match(customerFormError({ phone: '09171234567' }), /first name/)
    assert.match(customerFormError({ email: 'a@x.com' }), /mobile number/)
    assert.match(customerFormError({ phone: '09171234567', first: 'Ana', email: 'nope' }), /valid email/)
    assert.equal(customerFormError({ phone: '09171234567', first: 'Ana' }), '')
  })

  it('an existing match needs no name — the account already has one', () => {
    assert.equal(customerFormError({ phone: '09171234567', matched: true }), '')
    assert.equal(customerFormError({ email: 'a@x.com', matched: true }), '')
  })
})
