import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/** Mirrors sendCustomerSetupLink mode branching — reset must not force first-time flag semantics. */
function recoveryFlags(mode, alreadyMustSet) {
  const isReset = mode === 'reset'
  return {
    forceMustSetPassword: !isReset,
    status: isReset ? (alreadyMustSet ? 'needs_password' : 'ready') : 'needs_password',
    eventType: isReset ? 'password_reset' : 'account_invite',
  }
}

describe('password recovery modes', () => {
  it('setup mode forces must_set_password and account_invite event', () => {
    assert.deepEqual(recoveryFlags('setup', false), {
      forceMustSetPassword: true,
      status: 'needs_password',
      eventType: 'account_invite',
    })
  })

  it('reset mode does not force must_set_password for ready accounts', () => {
    assert.deepEqual(recoveryFlags('reset', false), {
      forceMustSetPassword: false,
      status: 'ready',
      eventType: 'password_reset',
    })
  })
})
