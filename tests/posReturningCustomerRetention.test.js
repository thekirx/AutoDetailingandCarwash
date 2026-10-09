import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveExistingCustomerUpdate } from '../server/provisionCustomer.mjs'

const NOW = '2026-10-10T12:00:00.000Z'
const LOGIN = '09171234567@customers.hakumautocare.com'

/** Call it the way provisionCustomerAccount does for a returning customer. */
function capture({ typedFirst, typedLast, existing, fallbackFullName }) {
  return resolveExistingCustomerUpdate({
    first: typedFirst || '',
    last: typedLast || '',
    existing,
    fullName: fallbackFullName,
    phone: '09171234567',
    email: null,
    loginEmail: LOGIN,
    now: NOW,
  })
}

describe('a returning customer keeps the data the cashier did not retype', () => {
  it('keeps the surname in full_name when only the first name is edited', () => {
    // Auto-fill put 'Maria' / 'Cruz' in the form. The cashier corrects the first
    // name and leaves the last alone. last_name stays 'Cruz', so full_name has to
    // read 'Maria Ana Cruz' — writing the typed name alone left the account
    // displaying 'Maria Ana' everywhere while last_name still said 'Cruz'.
    const { patch } = capture({
      typedFirst: 'Maria Ana',
      typedLast: '',
      existing: { first_name: 'Maria', last_name: 'Cruz', full_name: 'Maria Cruz', phone: '09171234567' },
      fallbackFullName: 'Maria Ana',
    })
    assert.equal(patch.full_name, 'Maria Ana Cruz')
    assert.equal(patch.first_name, 'Maria Ana')
    assert.equal(patch.last_name, 'Cruz')
  })

  it('keeps a fully blank name capture from touching the name at all', () => {
    // A phone-only record matched: the POS sends no name. Nothing may be wiped.
    const { patch } = capture({
      typedFirst: '',
      typedLast: '',
      existing: { first_name: 'Maria', last_name: 'Cruz', full_name: 'Maria Cruz', phone: '09171234567' },
      fallbackFullName: 'Maria Cruz',
    })
    assert.equal(patch.full_name, 'Maria Cruz')
    assert.equal(patch.first_name, 'Maria')
    assert.equal(patch.last_name, 'Cruz')
  })

  it('falls back to the walk-in label when the account has no name parts at all', () => {
    const { patch } = capture({
      typedFirst: '',
      typedLast: '',
      existing: { first_name: null, last_name: null, full_name: 'Walk-in · 4567', phone: '09171234567' },
      fallbackFullName: 'Walk-in · 4567',
    })
    assert.equal(patch.full_name, 'Walk-in · 4567')
    // Nothing was learned, so no part columns are written.
    assert.equal('first_name' in patch, false)
    assert.equal('last_name' in patch, false)
  })

  it('never lets a walk-in placeholder overwrite a real name', () => {
    const { patch } = capture({
      typedFirst: '',
      typedLast: '',
      existing: { first_name: 'Maria', last_name: 'Cruz', full_name: 'Maria Cruz', phone: '09171234567' },
      fallbackFullName: 'Walk-in · ABC123',
    })
    assert.equal(patch.full_name, 'Maria Cruz')
  })

  it('keeps the established phone rather than the one just typed', () => {
    const { patch } = capture({
      typedFirst: 'Maria',
      typedLast: 'Cruz',
      existing: { first_name: 'Maria', last_name: 'Cruz', full_name: 'Maria Cruz', phone: '09171234567' },
      fallbackFullName: 'Maria Cruz',
    })
    assert.equal(patch.phone, '09171234567')
    // A phone-only account has no real email, so the synthetic login address is kept.
    assert.equal(patch.email, LOGIN)
    assert.equal(patch.updated_at, NOW)
  })

  it('adopts a real email the cashier typed, and never blanks the name on the way', () => {
    const out = resolveExistingCustomerUpdate({
      first: 'Maria',
      last: '',
      existing: { first_name: 'Maria', last_name: 'Cruz', full_name: 'Maria Cruz', phone: '09171234567' },
      fullName: 'Maria',
      phone: '09171234567',
      email: 'maria@example.com',
      loginEmail: LOGIN,
      now: NOW,
    })
    assert.equal(out.patch.email, 'maria@example.com')
    assert.equal(out.patch.full_name, 'Maria Cruz')
    assert.equal(out.firstName, 'Maria')
    assert.equal(out.lastName, 'Cruz')
  })
})