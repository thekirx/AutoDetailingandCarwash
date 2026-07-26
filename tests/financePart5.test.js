import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ROLES, canAccessFinance, canWriteFinance } from '../src/auth/permissions.js'
import { sendFinanceQuote } from '../server/sendFinanceQuote.mjs'

describe('finance Part 5 write gates', () => {
  it('BossMich and Admin can write finance', () => {
    assert.equal(canWriteFinance({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canWriteFinance({ role: ROLES.ADMIN, branch_slug: 'bacoor' }), true)
    assert.equal(canAccessFinance({ role: ROLES.ADMIN }), true)
  })

  it('Assistant Super Admin needs finance_write grant to mutate', () => {
    const viewOnly = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }
    assert.equal(canAccessFinance(viewOnly), true)
    assert.equal(canWriteFinance(viewOnly), false)

    const writer = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { finance_write: true } }
    assert.equal(canWriteFinance(writer), true)
  })

  it('marketing cannot access finance', () => {
    assert.equal(canAccessFinance({ role: ROLES.MARKETING }), false)
    assert.equal(canWriteFinance({ role: ROLES.MARKETING }), false)
  })
})

describe('finance quote preview (no Resend key)', () => {
  it('returns preview when RESEND_API_KEY unset and token invalid → 401', async () => {
    const prev = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    // Missing service env or bad token — expect Unauthorized without hitting Resend
    await assert.rejects(
      () => sendFinanceQuote({ accessToken: null, body: { to: 'a@b.com' } }),
      /Unauthorized/,
    )
    if (prev !== undefined) process.env.RESEND_API_KEY = prev
  })
})
