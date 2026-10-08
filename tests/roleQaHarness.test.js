/**
 * Seam S6 — the role-QA harness must not lie.
 *
 * The harness is the thing everyone trusts when a role breaks, so it gets the
 * same treatment as the app: its persona table is checked against the real
 * gates, its retired routes against the real router, and its evidence path
 * against the file it writes. A harness that asserts the wrong expectation
 * produces a green run over a broken product.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ROLES,
  redirectForRole,
  allowRoute,
  OPS_LOGIN_ROLES,
} from '../src/auth/permissions.js'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const HARNESS = read('scripts/e2e-role-qa-wave.mjs')
/** Comments explain these very routes; strip them before asserting on them. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const HARNESS_CODE = stripComments(HARNESS)

/** Mirrors routeKey() in the harness — if this drifts, the harness drifts. */
function routeKey(url) {
  const rest = String(url).split('?')[0].replace(/^\/operations\//, '')
  if (rest === 'queue/new') return 'queue-new'
  if (rest.startsWith('settings/')) return 'settings'
  return rest.split('/')[0]
}

// ── The persona table itself ─────────────────────────────────────────────

/** Pull a top-level `const NAME = [...]` literal out of the harness source. */
function harnessLiteral(name) {
  const start = HARNESS.indexOf(`const ${name} = [`)
  assert.ok(start >= 0, `the harness must declare ${name}`)
  const open = HARNESS.indexOf('[', start)
  const close = HARNESS.indexOf('\n]', open)
  const literal = HARNESS.slice(open, close + 2)
  // ROLES is referenced inside the literal, so evaluate with it in scope.
  return Function('ROLES', `"use strict"; return ${literal}`)(ROLES)
}

test('every harness persona maps to a real demo account and a real role', () => {
  const personas = harnessLiteral('PERSONAS')
  assert.ok(personas.length >= 11, `expected the full persona set, got ${personas.length}`)
  for (const p of personas) {
    const acct = OPS_DEMO_ACCOUNTS.find((a) => a.id === p.id)
    assert.ok(acct, `${p.id} has no demo account in src/lib/demoAccounts.js`)
    assert.ok(acct.email && acct.password, `${p.id} demo account is missing credentials`)
    assert.ok(Object.values(ROLES).includes(p.role), `${p.id} uses unknown role ${p.role}`)
  }
  // No duplicate personas, and no account exercised twice under two names.
  const ids = personas.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length, 'duplicate persona id')
})

test('every harness role is an ops login role', () => {
  for (const p of harnessLiteral('PERSONAS')) {
    assert.ok(
      OPS_LOGIN_ROLES.includes(p.role),
      `${p.role} cannot sign in to the operations app, so this persona can only ever fail`,
    )
  }
})

test('every deny expectation is a route the role really cannot open', () => {
  // A "deny" that the gates allow is a false negative waiting to ship: the
  // harness would flag a correct product as broken, or miss a real leak.
  for (const p of harnessLiteral('PERSONAS')) {
    if (!p.deny) continue
    const profile = { role: p.role, branch_slug: 'bacoor', permission_grants: {} }
    assert.equal(
      allowRoute(profile, routeKey(p.deny)),
      false,
      `${p.role} is allowed ${p.deny}, so the harness deny check is wrong`,
    )
  }
})

test('the harness does not hardcode a landing page that redirectForRole disagrees with', () => {
  // The defect this exists to catch: boss/asa personas pinned to
  // /operations/console, a route removed from the app, so both always failed.
  for (const p of harnessLiteral('PERSONAS')) {
    const landing = redirectForRole(p.role)
    assert.match(
      landing,
      /^\/operations(\/|$)/,
      `${p.role} lands outside the operations app`,
    )
  }
  assert.doesNotMatch(
    HARNESS_CODE,
    /\/operations\/console/,
    '/operations/console was removed from the router; the harness must not reference it',
  )
  const appRoutes = stripComments(read('src/App.jsx'))
  assert.doesNotMatch(appRoutes, /operations\/console/, '/operations/console must stay out of the router')
})

test('every retired route the harness checks is still a redirect in the router', () => {
  const routes = harnessLiteral('RETIRED_ROUTES')
  assert.ok(routes.length >= 3, 'My Pay, Payroll and the legacy /admin must all be covered')
  for (const r of routes) {
    assert.match(r.from, /^\/[a-z]/, `retired route ${r.from} should be an app route`)
    assert.match(r.expect, /^\/operations(\/|$)/, `retired route ${r.from} must redirect into the operations app`)
    assert.notEqual(r.from, r.expect, `${r.from} would redirect to itself`)
  }
  const appRoutes = read('src/App.jsx')
  for (const r of routes) {
    // The operations routes are declared as children of the /operations layout,
    // so the router holds path="my-pay", not path="/operations/my-pay".
    const child = r.from.replace(/^\/operations\//, '')
    const idx = appRoutes.indexOf(`path="${child}"`)
    assert.ok(idx >= 0, `${r.from} is asserted as redirecting but the router has no such route`)
    // A retired route must still exist in the router as a redirect, not be
    // silently deleted: deleting it turns a redirect into a 404.
    assert.match(
      appRoutes.slice(idx, idx + 160),
      /Navigate/,
      `${r.from} must redirect, not render a page`,
    )
  }
})

// ── Evidence and honesty ─────────────────────────────────────────────────

test('the harness writes evidence where it claims to', () => {
  assert.match(HARNESS, /e2e-evidence', 'role-qa-wave'/)
  assert.match(HARNESS, /writeFileSync\(join\(outDir, 'summary\.json'\)/)
  assert.match(HARNESS, /process\.exit\(1\)/, 'a failed run must exit non-zero')
})

test('a deny cannot be satisfied by simply staying on the page', () => {
  // The old expectDeny passed when the URL changed, but a redirect loop back to
  // the same path would also pass. Require an actual wall or a redirect away.
  assert.match(HARNESS, /isDeniedWall\(url\)/)
  assert.match(HARNESS, /new URL\(url\)\.pathname === persona\.deny/)
  assert.match(HARNESS, /if \(stillOpen\)/, 'the harness must fail when the denied route is still reachable')
})

test('the harness collects console errors instead of trusting a clean render', () => {
  assert.match(HARNESS, /page\.on\('console'/)
  assert.match(HARNESS, /page\.on\('pageerror'/)
  assert.match(HARNESS, /errors\.take\(\)/)
  assert.match(HARNESS, /console`/, 'console errors must actually fail the check')
})

test('the harness reuses the shared login primitives rather than re-deriving them', () => {
  assert.match(HARNESS, /from '\.\/screenshotAuth\.mjs'/)
  assert.match(HARNESS, /from '\.\.\/src\/lib\/demoAccounts\.js'/)
  assert.match(HARNESS, /from '\.\.\/src\/auth\/permissions\.js'/)
  // Credentials must never be written into a script.
  assert.doesNotMatch(HARNESS, /Hakum[A-Z]\w*2026/, 'no credentials may be duplicated into a script')
})

test('the customer demo account is the shared one', () => {
  assert.ok(CUSTOMER_DEMO_ACCOUNT.email && CUSTOMER_DEMO_ACCOUNT.password)
  assert.match(HARNESS, /CUSTOMER_DEMO_ACCOUNT\.email/)
})

// ── The older pack must not keep a known-bad persona ─────────────────────

test('the harness holds the product to the gate that is actually enforced', () => {
  // OpsRoleGate calls allowRoute(), so allowRoute is the contract. Asserting
  // against canAccessFinance() instead reported Branch Admin as a product bug
  // when the route gate is what denies them (BUG-054).
  assert.match(HARNESS_CODE, /allowRoute\(profile, 'finance'\)/)
  assert.doesNotMatch(
    HARNESS_CODE,
    /if \(canAccessFinance\(profile\)\)/,
    'the finance check must follow the enforced route gate',
  )
})

test('the lane check matches the label the board actually renders', () => {
  // STATUS_SHORT_LABELS renders the lane as "PAYMENT"; STATUS_LABELS' "For
  // Payment" never appears on the board, so the first version of this check
  // failed for four roles that were correct.
  const short = read('src/queue/queueLogic.js')
  assert.match(short, /for_payment: 'Payment'/, 'the board lane is the short label')
  assert.match(HARNESS_CODE, /collect at pos/i, 'the harness must match the rendered lane hint')
  assert.doesNotMatch(
    HARNESS_CODE,
    /for\\s\*payment/i,
    'matching the long status label gave a false negative on the board',
  )
})

test('a retired route is judged by not surviving, not by an exact final URL', () => {
  // /operations and /operations/login forward again to the role's own home, so
  // asserting the exact landing URL failed for routes that redirect correctly.
  assert.match(HARNESS_CODE, /stayedPut/)
  assert.match(HARNESS_CODE, /leftTheApp/)
  const routes = harnessLiteral('RETIRED_ROUTES')
  for (const r of routes) {
    // /admin forwards to /operations/login, which is outside /operations.
    if (r.from.startsWith('/admin')) continue
    assert.match(r.expect, /^\/operations(\/|$)/)
  }
})

test('the previous role pack no longer pins boss/asa to the removed console route', () => {
  const legacy = 'scripts/e2e-role-qa.mjs'
  assert.ok(existsSync(join(root, legacy)), 'the legacy pack should still exist for reference')
  const src = read(legacy)
  const stale = /id: '(boss|asa)'[^}]*home: '\/operations\/console'/.test(src)
  assert.equal(
    stale,
    false,
    'e2e-role-qa.mjs still sends boss/asa to /operations/console, which no longer exists',
  )
})

test('a console failure names the route it happened on', () => {
  // Observed 2026-10-09: `admin.console` failed with three bare
  //   "Failed to load resource: the server responded with a status of 401"
  // and named no route at all. The harness walks ten dock pages before it reads
  // the bucket, so a role-scoped message is not actionable — this is the same
  // defect class as BUG-064, where a red wave told nobody what to fix.
  //
  // Both handlers must carry the route, and the route must be read at event time
  // (`page.url()`), not captured once at attach time, or every error would be
  // attributed to whichever page happened to be open when collectErrors ran.
  assert.match(HARNESS_CODE, /const where = \(\) =>/, 'a helper must resolve the current route')
  // Anchored to the helper's own body. A bare /page\.url\(\)/ elsewhere in the
  // file satisfies a file-wide match — an earlier version of this assertion did
  // exactly that, and the mutation it was supposed to catch sailed through.
  // It then survived a second version too: where()'s catch branch also calls
  // page.url(), so presence alone cannot tell "reads the route" from "ignores it".
  // The property that actually matters is that the route is *derived* from the
  // live URL, so that is what gets asserted.
  const whereBody = HARNESS_CODE.match(/const where = \(\) => \{[\s\S]*?\n\s*\}/)?.[0] || ''
  assert.ok(whereBody, 'the where() helper must have a body to inspect')
  assert.match(
    whereBody,
    /new URL\(page\.url\(\)\)\.pathname/,
    'where() must derive the route from the live page URL, not return a constant',
  )
  assert.match(HARNESS_CODE, /console @\$\{where\(\)\}/, 'console errors must carry their route')
  assert.match(HARNESS_CODE, /pageerror @\$\{where\(\)\}/, 'page errors must carry their route')
  // And the bucket must still be drained per persona, or attribution accumulates
  // into the next role and the message points at the wrong walk.
  assert.match(HARNESS_CODE, /errors\.take\(\)/, 'the bucket must still be drained per persona')
  assert.match(HARNESS_CODE, /favicon\|ResizeObserver/, 'benign noise must still be filtered')
  // The console string for a failed fetch names neither URL nor status, so the
  // harness has to listen on the wire or the 401 is permanently unactionable.
  // Scoped to 401/403 — widening it to all 4xx/5xx would drag in dev-server 404s
  // that are not product faults.
  assert.match(HARNESS_CODE, /page\.on\('response'/, 'auth failures must be captured from the wire')
  assert.match(HARNESS_CODE, /http \$\{status\} @\$\{where\(\)\}/, 'the failing URL must be reported')
  assert.match(
    HARNESS_CODE,
    /status !== 401 && status !== 403/,
    'only auth failures belong in the bucket, or dev-server 404s become product faults',
  )
})

test('no navigation in the harness can throw into the top-level catch', () => {
  // BUG-064 routed `evaluate` through safeEvaluate and left `page.goto` bare, so
  // the same defect came back through a different door on 2026-10-09:
  // `net::ERR_ABORTED at /operations/attendance` unwound to the top-level catch,
  // printed `fatal`, and ended the wave at 87/87 — every check after that point
  // silently never ran. A collapsed total is the tell, and a short run that looks
  // green is worse than a red one.
  //
  // So: every `page.goto` must either be the single retrying call inside
  // gotoRoute, or be individually .catch()ed. This walks the source rather than
  // grepping for a symbol, because the defect is *where* the call sits.
  const lines = HARNESS_CODE.split('\n')
  const offenders = []
  let inHelper = false
  for (const line of lines) {
    if (/async function gotoRoute\(/.test(line)) inHelper = true
    if (!inHelper && /await page\.goto\(/.test(line) && !/\.catch\(/.test(line)) {
      offenders.push(line.trim())
    }
    if (inHelper && /^\}/.test(line)) inHelper = false
  }
  assert.deepEqual(
    offenders,
    [],
    `an unguarded page.goto would truncate the whole wave: ${offenders.join(' | ')}`,
  )
  // The helper must actually retry rather than swallow on the first attempt.
  assert.match(HARNESS_CODE, /async function gotoRoute\(page, url, attempts = 3\)/)
  assert.match(HARNESS_CODE, /for \(let i = 0; i < attempts; i\+\+\)/, 'gotoRoute must retry')
  assert.match(HARNESS_CODE, /return \{ ok: false, why: last \}/, 'gotoRoute must report why it gave up')
})