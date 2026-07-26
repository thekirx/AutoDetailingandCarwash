import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/** Mirrors sendCustomerSetupLink mode branching — auth is Supabase email only (no SMS). */
function recoveryFlags(mode, alreadyMustSet) {
  const isReset = mode === 'reset'
  return {
    forceMustSetPassword: !isReset,
    status: isReset ? (alreadyMustSet ? 'needs_password' : 'ready') : 'needs_password',
    via: 'email',
  }
}

function canEmailReset(loginEmail) {
  return !String(loginEmail || '').endsWith('@customers.hakumautocare.com')
}

describe('password recovery modes', () => {
  it('setup mode forces must_set_password and email via', () => {
    assert.deepEqual(recoveryFlags('setup', false), {
      forceMustSetPassword: true,
      status: 'needs_password',
      via: 'email',
    })
  })

  it('reset mode does not force must_set_password for ready accounts', () => {
    assert.deepEqual(recoveryFlags('reset', false), {
      forceMustSetPassword: false,
      status: 'ready',
      via: 'email',
    })
  })

  it('rejects synthetic phone login emails for Supabase mail', () => {
    assert.equal(canEmailReset('639171234567@customers.hakumautocare.com'), false)
    assert.equal(canEmailReset('demo.customer@hakumautocare.com'), true)
  })
})
