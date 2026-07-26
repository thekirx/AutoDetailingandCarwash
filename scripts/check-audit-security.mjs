/**
 * Security + audit invariants after P0 harden pass.
 * node scripts/check-audit-security.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const portal = read('server/customerPortal.mjs')
assert.match(portal, /never trust user_metadata\.role/)
assert.match(portal, /Own row only/)
assert.doesNotMatch(portal, /\.upsert\(payload/)
assert.match(portal, /23505/)

const lookup = read('server/customerAuthLookup.mjs')
assert.match(lookup, /rateLimit/)
assert.match(lookup, /never return login_email/)
const sendFn = lookup.slice(lookup.indexOf('export async function sendCustomerSetupLink'))
assert.doesNotMatch(sendFn.slice(0, sendFn.indexOf('export async function handleCustomerAuthLookupRequest')), /login_email: loginEmail/)
assert.match(sendFn, /sent: true/)

const http = read('server/httpUtil.mjs')
assert.match(http, /export function rateLimit/)
assert.match(http, /export function clientIp/)

const vercel = read('vercel.json')
assert.match(vercel, /Content-Security-Policy/)
assert.match(vercel, /X-Frame-Options/)

const app = read('src/App.jsx')
assert.match(app, /unauthorizedTo="\/signin"/)
assert.match(app, /Navigate to="\/operations\/queue"/)
assert.match(app, /Navigate to="\/operations\/reports"/)
assert.doesNotMatch(app, /AdminPage/)

const chips = read('src/components/DemoAccountChips.jsx')
assert.match(chips, /import\.meta\.env\.DEV/)

const pr = read('src/auth/ProtectedRoute.jsx')
assert.match(pr, /unauthorizedTo/)

assert.ok(read('AUDIT.md').includes('Route inventory'))
assert.ok(read('AUDIT_CHECKLIST.md').includes('Definition of 100%'))
assert.ok(read('SECURITY_AUDIT.md').includes('Security (2).md'))

console.log('check-audit-security: ok')
