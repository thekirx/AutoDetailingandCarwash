import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  opsRouteKeyFromPath,
  resolveCustomerPostLoginPath,
  resolvePostLoginPath,
  safeAuthReturnPath,
  safeAuthReturnUrl,
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
    assert.equal(
      safeAuthReturnUrl({ pathname: '/operations/finance', search: '?tab=sheets&sheet=s1' }),
      '/operations/finance?tab=sheets&sheet=s1',
    )
    assert.equal(safeAuthReturnUrl('//evil.example/phish'), null)
  })
})

describe('resolvePostLoginPath', () => {
  it('maps ops paths to allowRoute keys', () => {
    assert.equal(opsRouteKeyFromPath('/operations/queue'), 'queue')
    assert.equal(opsRouteKeyFromPath('/operations/queue/new'), 'queue-new')
    assert.equal(opsRouteKeyFromPath('/operations/queue/abc'), 'queue')
    assert.equal(opsRouteKeyFromPath('/operations/settings'), 'settings')
    assert.equal(opsRouteKeyFromPath('/operations/payroll'), null)
    assert.equal(opsRouteKeyFromPath('/operations/my-pay'), null)
    assert.equal(opsRouteKeyFromPath('/operations/attendance'), 'attendance')
    assert.equal(opsRouteKeyFromPath('/operations/history'), 'history')
    assert.equal(opsRouteKeyFromPath('/operations/reviews'), 'reviews')
    assert.equal(opsRouteKeyFromPath('/operations/content'), 'content')
    assert.equal(opsRouteKeyFromPath('/operations/notifications'), 'notifications')
    assert.equal(opsRouteKeyFromPath('/operations/broadcast'), 'notifications')
    assert.equal(opsRouteKeyFromPath('/operations/vehicle-transfer'), 'vehicle-transfer')
    assert.equal(opsRouteKeyFromPath('/operations/my-advances'), 'my-advances')
    assert.equal(opsRouteKeyFromPath('/operations/payslips'), 'payslips')
    assert.equal(opsRouteKeyFromPath('/operations/approvals'), 'approvals')
    assert.equal(opsRouteKeyFromPath('/operations/monthly-payroll'), 'monthly-payroll')
    assert.equal(opsRouteKeyFromPath('/operations/merch-shop'), 'merch-shop')
    assert.equal(opsRouteKeyFromPath('/operations/vouchers'), 'vouchers')
    assert.equal(opsRouteKeyFromPath('/operations/access-denied'), null)
  })

  it('preserves query parameters across post-login deep links for ops and customers', () => {
    const boss = { role: ROLES.SUPER_ADMIN }
    assert.equal(
      resolvePostLoginPath(boss, { pathname: '/operations/finance', search: '?tab=sheets&sheet=sh-9' }),
      '/operations/finance?tab=sheets&sheet=sh-9',
    )
    assert.equal(
      resolveCustomerPostLoginPath({ pathname: '/account/book', search: '?service=paint-maintenance' }),
      '/account/book?service=paint-maintenance',
    )
    assert.equal(resolveCustomerPostLoginPath({ pathname: '/operations/pos', search: '' }), '/account')
    assert.equal(resolveCustomerPostLoginPath('//evil.example/account'), '/account')
  })

  it('ignores deep-links the role cannot open (avoids login → access-denied)', () => {
    const sales = { role: ROLES.SALES, branch_slug: 'bacoor' }
    assert.equal(resolvePostLoginPath(sales, '/operations/console'), '/operations/bookings')
    assert.equal(resolvePostLoginPath(sales, '/operations/bookings'), '/operations/bookings')
    assert.equal(resolvePostLoginPath(sales, '/operations/access-denied'), '/operations/bookings')
  })

  it('sends Super Admin to the Floor Board home when no return path', () => {
    assert.equal(resolvePostLoginPath({ role: ROLES.SUPER_ADMIN }, null), '/operations/dashboard')
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
