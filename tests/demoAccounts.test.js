import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
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
      assert.ok(!/cashier/i.test(a.id + a.label + a.email))
    }
    assert.equal(CUSTOMER_DEMO_ACCOUNT.email, 'demo.customer@hakumautocare.com')
  })

  it('names an env var for every password and keeps none in source (the repo is public)', () => {
    for (const a of [...OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT]) {
      assert.match(a.passwordEnv || '', /^VITE_DEMO_PASSWORD_[A-Z0-9]+$/, `${a.id} has no password env var`)
    }
    const src = readFileSync(new URL('../src/lib/demoAccounts.js', import.meta.url), 'utf8')
    assert.doesNotMatch(src, /password:\s*['"`]/, 'a literal password is back in demoAccounts.js')
  })

  it('reads the password from the environment when asked, and is empty when unset', () => {
    const sales = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'sales')
    const before = process.env[sales.passwordEnv]
    try {
      process.env[sales.passwordEnv] = 'from-env-123'
      assert.equal(sales.password, 'from-env-123')
      delete process.env[sales.passwordEnv]
      assert.equal(sales.password, '')
    } finally {
      if (before === undefined) delete process.env[sales.passwordEnv]
      else process.env[sales.passwordEnv] = before
    }
  })

  it('demo chips cover every ROLES value at least once', () => {
    const covered = new Set(Object.values(DEMO_ROLE_BY_ID))
    for (const role of Object.values(ROLES)) {
      assert.ok(covered.has(role), `no demo chip for role ${role}`)
    }
  })
})
