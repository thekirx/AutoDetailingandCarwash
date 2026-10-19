/**
 * Birthday greeting opens the voucher page, and the claim stays available until POS uses it.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const read = (path) => readFileSync(path, 'utf8')

describe('birthday voucher claim', () => {
  it('greeting inbox and push open /account/vouchers', () => {
    const greet = read('server/birthdayGreetings.mjs')
    assert.match(greet, /CUSTOMER_VOUCHERS_PATH/)
    assert.doesNotMatch(greet, /url: '\/account'/)
  })

  it('voucher page claims on the birthday until the wash is used', () => {
    const page = read('src/pages/CustomerVouchersPage.jsx')
    const portal = read('server/customerPortal.mjs')
    assert.match(page, /portalAction\('claim-birthday'\)/)
    assert.match(page, /disabled=\{!canClaim/)
    assert.doesNotMatch(page, /disabled=\{!isToday \|\| ready/)
    assert.match(portal, /action === 'claim-birthday'/)
    assert.match(portal, /used: Boolean\(usedPerk\)/)
  })
})
