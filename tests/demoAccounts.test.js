import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CUSTOMER_DEMO_ACCOUNT, OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

describe('demo accounts', () => {
  it('exposes ops and customer demos with passwords', () => {
    assert.ok(OPS_DEMO_ACCOUNTS.length >= 9)
    const ids = OPS_DEMO_ACCOUNTS.map((a) => a.id)
    for (const need of [
      'boss',
      'asa',
      'admin',
      'tl',
      'sales',
      'crew1',
      'crew2',
      'crew3',
      'marketing',
      'detailer',
      'video',
      'investor',
    ]) {
      assert.ok(ids.includes(need), `missing demo chip: ${need}`)
    }
    for (const a of OPS_DEMO_ACCOUNTS) {
      assert.ok(a.email.includes('@'))
      assert.ok(a.password.length >= 8)
      assert.ok(!/cashier/i.test(a.id + a.label + a.email))
    }
    assert.equal(CUSTOMER_DEMO_ACCOUNT.email, 'demo.customer@hakumautocare.com')
    assert.ok(CUSTOMER_DEMO_ACCOUNT.password.length >= 8)
  })
})
