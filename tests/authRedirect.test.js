import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  opsRouteKeyFromPath,
  resolvePostLoginPath,
  safeAuthReturnPath,
} from '../src/auth/authRedirect.js'
import { ROLES } from '../src/auth/permissions.js'

describe('safeAuthReturnPath', () => {
  it('blocks access-denied and auth pages so Back to login cannot bounce into a session loop', () => {
    assert.equal(safeAuthReturnPath('/operations/access-denied'), null)
    assert.equal(safeAuthReturnPath('/operations/login'), null)
    assert.equal(safeAuthReturnPath('/signin'), null)
    assert.equal(safeAuthReturnPath('/operations/queue'), '/operations/queue')
    assert.equal(safeAuthReturnPath('/operations/dashboard?x=1'), '/operations/dashboard')
    assert.equal(safeAuthReturnPath(undefined, { fallback: '/operations/console' }), '/operations/console')
  })
})

describe('resolvePostLoginPath', () => {
  it('maps ops paths to allowRoute keys', () => {
    assert.equal(opsRouteKeyFromPath('/operations/queue'), 'queue')
    assert.equal(opsRouteKeyFromPath('/operations/queue/new'), 'queue-new')
    assert.equal(opsRouteKeyFromPath('/operations/queue/abc'), 'queue')
    assert.equal(opsRouteKeyFromPath('/operations/settings'), 'settings')
    assert.equal(opsRouteKeyFromPath('/operations/payroll'), 'payroll')
    assert.equal(opsRouteKeyFromPath('/operations/my-pay'), 'my-pay')
    assert.equal(opsRouteKeyFromPath('/operations/attendance'), 'attendance')
    assert.equal(opsRouteKeyFromPath('/operations/history'), 'history')
    assert.equal(opsRouteKeyFromPath('/operations/reviews'), 'reviews')
    assert.equal(opsRouteKeyFromPath('/operations/content'), 'content')
    assert.equal(opsRouteKeyFromPath('/operations/notifications'), 'notifications')
    assert.equal(opsRouteKeyFromPath('/operations/broadcast'), 'notifications')
    assert.equal(opsRouteKeyFromPath('/operations/access-denied'), null)
  })

  it('ignores deep-links the role cannot open (avoids login → access-denied)', () => {
    const sales = { role: ROLES.SALES, branch_slug: 'bacoor' }
    assert.equal(resolvePostLoginPath(sales, '/operations/console'), '/operations/bookings')
    assert.equal(resolvePostLoginPath(sales, '/operations/bookings'), '/operations/bookings')
    assert.equal(resolvePostLoginPath(sales, '/operations/access-denied'), '/operations/bookings')
  })

  it('sends Super Admin to console home when no return path', () => {
    assert.equal(resolvePostLoginPath({ role: ROLES.SUPER_ADMIN }, null), '/operations/console')
  })

  it('skips a denied role home so ASA without console does not loop', () => {
    const asa = {
      role: ROLES.ASSISTANT_SUPER_ADMIN,
      permission_grants: { console: false },
    }
    const home = resolvePostLoginPath(asa, null)
    assert.notEqual(home, '/operations/console')
    assert.match(home, /^\/operations\//)
  })
})
