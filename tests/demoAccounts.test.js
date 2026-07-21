import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CUSTOMER_DEMO_ACCOUNT, OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

describe('demo accounts', () => {
  it('exposes ops and customer demos with passwords', () => {
    assert.ok(OPS_DEMO_ACCOUNTS.length >= 3)
    for (const a of OPS_DEMO_ACCOUNTS) {
      assert.ok(a.email.includes('@'))
      assert.ok(a.password.length >= 8)
    }
    assert.equal(CUSTOMER_DEMO_ACCOUNT.email, 'demo.customer@hakumautocare.com')
    assert.ok(CUSTOMER_DEMO_ACCOUNT.password.length >= 8)
  })
})
