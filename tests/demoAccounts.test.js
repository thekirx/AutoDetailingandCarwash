import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CUSTOMER_DEMO_ACCOUNT, OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'
import { ROLES } from '../src/auth/permissions.js'

/** Demo chip id → expected staff role (covers every ROLES value). */
const DEMO_ROLE_BY_ID = {
  boss: ROLES.SUPER_ADMIN,
  asa: ROLES.ASSISTANT_SUPER_ADMIN,
  admin: ROLES.ADMIN,
  opslead: ROLES.OPERATIONS_LEAD,
  tl: ROLES.TEAM_LEAD,
  sales: ROLES.SALES,
  crew1: ROLES.STAFF,
  crew2: ROLES.STAFF,
  crew3: ROLES.STAFF,
  marketing: ROLES.MARKETING,
  detailer: ROLES.DETAILER,
  video: ROLES.VIDEO_EDITOR,
  investor: ROLES.INVESTOR,
}

describe('demo accounts', () => {
  it('exposes ops and customer demos with passwords', () => {
    assert.ok(OPS_DEMO_ACCOUNTS.length >= 9)
    const ids = OPS_DEMO_ACCOUNTS.map((a) => a.id)
    for (const need of Object.keys(DEMO_ROLE_BY_ID)) {
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

  it('demo chips cover every ROLES value at least once', () => {
    const covered = new Set(Object.values(DEMO_ROLE_BY_ID))
    for (const role of Object.values(ROLES)) {
      assert.ok(covered.has(role), `no demo chip for role ${role}`)
    }
  })
})
