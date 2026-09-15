/**
 * Inbox / push deep-link normalization for customer + staff shells.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { notificationHref } from '../src/lib/notificationUrl.js'

assert.equal(notificationHref('', '/account'), '/account')
assert.equal(notificationHref('/', '/account'), '/account')
assert.equal(notificationHref('/account/queue', '/account'), '/account/queue')
assert.equal(notificationHref('/account/more?tab=alerts', '/account'), '/account/more?tab=alerts')
assert.equal(notificationHref('https://evil.example/phish', '/account'), '/account')
assert.equal(notificationHref('not-a-path', '/operations'), '/operations')

const sw = readFileSync('public/push-sw.js', 'utf8')
assert.match(sw, /HAKUM_NAV/)
assert.match(sw, /clients\.openWindow/)
assert.match(sw, /Never focus-only/)
assert.match(sw, /client\.navigate/)
assert.match(sw, /postMessage/)

const bell = readFileSync('src/components/NotificationBell.jsx', 'utf8')
assert.match(bell, /notificationHref\(row\.url, homeUrl\)/)

const more = readFileSync('src/pages/CustomerMorePage.jsx', 'utf8')
assert.match(more, /tab=alerts/)
assert.match(more, /notificationHref\(row\.url/)

const account = readFileSync('src/pages/CustomerAccountPage.jsx', 'utf8')
assert.match(account, /tab=alerts/)

const push = readFileSync('src/lib/push.js', 'utf8')
assert.match(push, /healPushSubscription/)
assert.match(push, /userVisibleOnly:\s*true/)

console.log('notificationUrl + push redirect seam: ok')
