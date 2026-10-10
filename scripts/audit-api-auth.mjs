/**
 * Audit the /api/* auth boundary. Exits non-zero if a handler is reachable
 * without authentication and is not on the documented public list.
 *
 * WHY THIS EXISTS
 * These handlers run with the SUPABASE SERVICE ROLE key, which bypasses RLS
 * completely. So for /api/*, RLS is not a backstop: if a handler stops at "is
 * there a token", the caller reads or writes every row. Hiding the page in the
 * UI is not a boundary — that is the same lesson as BUG-079, one layer over,
 * and BUG-083 was the same lesson again from the client side.
 *
 * WHY IT VALIDATES ITSELF FIRST
 * This audit is the fourth detector I have got wrong while auditing (after a
 * naive brace slice, a payment-bucket guess, and assuming `bearer(req)` was
 * the only auth pattern). Each of those produced confident false positives.
 * So the CONTROLS block runs first, against three handlers whose answers are
 * already known, and the process EXITS 1 without printing a verdict if they
 * disagree. A detector that cannot show it is right about things already
 * checked is not evidence about things not checked.
 *
 * Two shapes of handler this cannot judge by reading the handler alone:
 *   - scoping delegated to a service function it calls (see DELEGATED)
 *   - a route public by design (see PUBLIC)
 * Both lists are explicit, so "public" and "delegated" are decisions on record
 * rather than absences of evidence. Adding a handler to either one is a
 * deliberate act that a reviewer can see in the diff.
 *
 *   node scripts/audit-api-auth.mjs
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const HANDLER = /export\s+(?:async\s+)?function\s+(handle\w*Request|handleApi)\b/

/** Public on purpose. */
const PUBLIC = {
  handleCustomerAuthLookupRequest: 'customer sign-in; the caller has no session yet by definition',
  handleCustomerSignupRequest: 'customer sign-up; the caller has no session yet by definition',
  handlePublicInquiryRequest: 'public contact form; the whole point is that anyone can post',
  handleBusybeeRelayRequest: 'outbound SMS relay; reached from our own sending path, not a browser session',
  handlePublicBookRequest:
    'public booking. The optional JWT only attaches customer_id, and only when customers.role = customer (resolveBookingCustomerId) — never phone or metadata',
  handleNotifyOpsFormRequest:
    'public form notifier. The bearer is optional by design ("staff fill may send a bearer; public forms do not"); rate limited per IP',
}

/**
 * Authenticates in the handler, then hands the token to a service function that
 * does the scoping. Each entry names the helper so it can be READ, not trusted.
 */
const DELEGATED = {
  handleProvisionStaffRequest: 'provisionStaffAccount -> assertStaffManagerCaller() (+ ASA people grant)',
  handleProvisionRequest: 'provisionCustomerAccount -> assertQueueEditor()',
  handleCustomerPortalRequest: 'requireCustomer() -> scopes every read by user_id = auth.uid()',
  handleFinanceQuoteRequest: 'verifies getUser(accessToken) then loads the staff row before acting',
  handleDataCenterRequest: 'requireSuperAdmin() -> staff.role must be exactly BossMich',
  handleNotifyBookingRequest: 'bearer -> staff_profiles -> ALLOWED role allowlist -> 403',
  handleBusybeeRequest: 'bearer -> staff_profiles -> inline role allowlist -> 403',
}

/** Known answers. If these change, the detector is wrong and says so. */
const CONTROLS = [
  ['handleProvisionStaffRequest', true, 'authenticates via injected getAccessToken()'],
  ['handleCustomerHistoryRequest', true, 'authenticates via bearer(req) in the handler'],
  ['handleCustomerSignupRequest', false, 'public sign-up'],
]

function* handlerFiles() {
  for (const dir of ['api', 'server']) {
    for (const f of readdirSync(join(root, dir)).filter((x) => /\.(js|mjs)$/.test(x))) {
      yield { path: join(root, dir, f), name: f }
    }
  }
}

const rows = []
for (const { path, name: file } of handlerFiles()) {
  const text = readFileSync(path, 'utf8')
  const m = HANDLER.exec(text)
  if (!m) continue
  const body = text.slice(m.index)
  rows.push({
    name: m[1],
    file: `${file.includes('.') ? path.slice(path.indexOf(join('api', 'x')) >= 0 ? root.length + 1 : root.length + 1) : path}`,
    auth: /bearer\(req\)/.test(body) || /getAccessToken\(\)/.test(body),
    cron: /cronAuthorized|CRON_SECRET/.test(body),
    scopedHere:
      /branch_slug|user_has_branch_access|branchFilter|_ROLES\b|is_super_admin|current_user_role|permission_grants|hasGrant|canEdit|canAccess|user_id|auth\.uid\(\)/.test(
        body,
      ),
  })
}

let controlsOk = true
for (const [name, expected, why] of CONTROLS) {
  const row = rows.find((r) => r.name === name)
  const got = row ? row.auth || row.cron : null
  const ok = got === expected
  if (!ok) controlsOk = false
  console.log(
    `control ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(34)} expected auth=${String(expected).padEnd(5)} got ${String(got).padEnd(5)}  (${why})`,
  )
}
console.log('')
if (!controlsOk) {
  console.error('The detector failed its own controls. No verdict is printed — the auth patterns in')
  console.error('this repo have probably changed. Fix the patterns above before trusting any of this.')
  process.exit(1)
}

for (const [name] of [...Object.entries(PUBLIC), ...Object.entries(DELEGATED)]) {
  if (!rows.some((r) => r.name === name)) console.log(`STALE  ${name} is listed but no longer exists`)
}

const offenders = rows
  .filter((r) => !r.auth && !r.cron && !(r.name in PUBLIC))
  .map((r) => `  ${r.name}  (${r.file})`)

// A public route may still OPTIONALLY read a bearer (public booking attaches the
// customer when a JWT happens to be present; the form notifier validates one
// when the staff app sends it). `auth` is therefore true for a public handler,
// so PUBLIC has to be excluded here too — otherwise every optional-auth public
// endpoint reads as "authenticates but unscoped", which is how the first version
// of this script produced two false alarms.
const unaudited = rows
  .filter((r) => (r.auth || r.cron) && !r.scopedHere && !(r.name in DELEGATED) && !(r.name in PUBLIC))
  .map((r) => `  ${r.name}  (${r.file})`)

console.log(`handlers scanned: ${rows.length}`)
console.log(`unauthenticated and not on the public list: ${offenders.length}`)
for (const o of offenders) console.log(o)
console.log(`authenticates but shows no scope in the handler and is not on the delegated list: ${unaudited.length}`)
for (const u of unaudited) console.log(u)

if (offenders.length || unaudited.length) {
  console.error('\nEither fix the handlers, or — if they are genuinely fine — add them to PUBLIC or')
  console.error('DELEGATED above with the reason, so the next run does not have to re-derive it.')
  process.exit(1)
}

console.log('\nOK — every /api/* handler either authenticates, is public by design, or delegates to a')
console.log('named scoping helper. Note this is a boundary audit, not a behaviour test: a handler can')
console.log('authenticate correctly and still return the wrong rows.')