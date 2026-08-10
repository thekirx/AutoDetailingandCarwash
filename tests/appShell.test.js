import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { prefersAppShell, resolveAppHome, APP_SHELL_PATH, MARKETING_HOME_PATH } from '../src/lib/appShell.js'
import { ROLES } from '../src/auth/permissions.js'

describe('prefersAppShell', () => {
  it('opens app shell for installed PWA / standalone', () => {
    assert.equal(prefersAppShell({ standalone: true, mobileUa: false, narrow: false, touch: false }), true)
  })

  it('opens app shell for phone UA', () => {
    assert.equal(prefersAppShell({ standalone: false, mobileUa: true, narrow: false, touch: false }), true)
  })

  it('opens app shell for narrow touch viewport', () => {
    assert.equal(prefersAppShell({ standalone: false, mobileUa: false, narrow: true, touch: true }), true)
  })

  it('keeps marketing site on desktop browser', () => {
    assert.equal(prefersAppShell({ standalone: false, mobileUa: false, narrow: false, touch: false }), false)
    assert.equal(prefersAppShell({ standalone: false, mobileUa: false, narrow: true, touch: false }), false)
  })
})

describe('resolveAppHome', () => {
  it('sends customers to account', () => {
    assert.equal(resolveAppHome({ role: 'customer' }), '/account')
  })

  it('sends ops roles to their floor home', () => {
    assert.equal(resolveAppHome({ role: ROLES.SUPER_ADMIN }), '/operations/console')
    assert.ok(String(resolveAppHome({ role: ROLES.TEAM_LEAD }) || '').startsWith('/operations/'))
  })

  it('returns null without a role', () => {
    assert.equal(resolveAppHome(null), null)
    assert.equal(resolveAppHome({}), null)
  })
})

describe('app shell paths', () => {
  it('exports stable entry paths', () => {
    assert.equal(APP_SHELL_PATH, '/app')
    assert.equal(MARKETING_HOME_PATH, '/home')
  })
})
