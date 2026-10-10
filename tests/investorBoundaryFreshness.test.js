import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROLES,
  getOperationsNav,
  allowRoute,
  INVESTOR_ROUTE_KEYS,
  canEditFinanceBooks,
} from '../src/auth/permissions.js'
import { canAccessCorporateFinance } from '../src/lib/financeCorporate.js'

/**
 * The investor boundary, and the freshness of the gate that checks it.
 *
 * `e2e-ops-cutover.mjs` asserted `nav.length === 1 && nav[0].to ===
 * '/operations/finance'` — an expectation written at e52d125 and superseded by
 * f1cb989 ("role access fixes"), which deliberately widened INVESTOR_ROUTE_KEYS.
 * The gate kept the old wording, so `npm run test:readiness` reported a critical
 * FAIL for a policy that had been changed on purpose. A red gate that is wrong
 * about the app is worse than no gate: it trains the owner to ignore red.
 *
 * So the policy is pinned here as a *containment* invariant — every route the
 * investor is shown must be one the gate allows, and the gate must grant
 * read-only surfaces only — rather than as a hardcoded list that goes stale the
 * same way. This runs in the unit suite, so drift shows up in seconds rather than
 * only when someone runs the full readiness sweep.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
/**
 * Comments are stripped before anything is matched against them. The cutover
 * script explains the old assertion in prose, and a comment naming the defect
 * satisfies a grep for the defect — this file hit that itself on first run.
 *
 * Line comments are stripped BEFORE block comments, deliberately. A block-comment
 * stripper alone can pair an apparent opener that lives inside prose (a URL ending
 * in a slash-star) with an unrelated terminator further down, and silently delete
 * real code in between — which makes an assertion unable to match code that is
 * present and correct.
 * Only whole-line `//` comments are removed, so a `https://` inside a string is safe.
 */
const code = (p) => read(p).replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
const investor = { role: ROLES.INVESTOR }
const keyOf = (to) => String(to || '').replace(/^\/operations\/?/, '')

describe('the investor sees only what the investor gate allows', () => {
  const navKeys = getOperationsNav(investor).map((i) => keyOf(i.to))

  it('has somewhere to land', () => {
    assert.ok(navKeys.length > 0, 'an empty investor nav leaves the role with no landing page')
  })

  it('shows no route the gate would refuse', () => {
    // Meaningful because it walks the *nav* side: allowRoute is defined as
    // INVESTOR_ROUTE_KEYS.includes(key), so asserting the allow-list against
    // allowRoute would be tautological and could never fail. The nav is the side
    // that can actually drift out of step with the gate.
    for (const key of navKeys) {
      assert.ok(allowRoute(investor, key), `investor nav shows /operations/${key} but allowRoute denies it`)
    }
  })

  it('keeps the allow-list free of typos the gate cannot resolve', () => {
    // Not "allowRoute agrees with the list" — it is defined from the list. What
    // can actually be wrong is the list naming a route key the router has no
    // route for, which would render as a dead nav entry nobody notices.
    const ROUTER_ROUTES = read('src/App.jsx')
    for (const key of INVESTOR_ROUTE_KEYS) {
      assert.ok(
        ROUTER_ROUTES.includes(`/${key}`) || ROUTER_ROUTES.includes(`operations/${key}`),
        `INVESTOR_ROUTE_KEYS lists "${key}" but App.jsx has no such operations route`,
      )
    }
  })

  it('stays read-only', () => {
    assert.equal(canEditFinanceBooks(investor), false, 'investor chrome must not write the books')
    assert.equal(canAccessCorporateFinance(investor), false, 'investor must never see corporate/HQ books')
  })
})

describe('the cutover gate cannot drift back into a hardcoded route list', () => {
  const cutover = code('scripts/e2e-ops-cutover.mjs')

  it('derives the expectation from the allow-list instead of pinning a length', () => {
    assert.ok(
      !/nav\.length === \d+/.test(cutover),
      'a hardcoded nav length goes stale the moment a role-access change lands — derive it instead',
    )
    assert.match(cutover, /INVESTOR_ROUTE_KEYS/, 'the gate must read the current allow-list')
    assert.match(cutover, /allowRoute\(/, 'the gate must check nav against the route gate')
  })

  it('still asserts the security invariants that the widening did not touch', () => {
    assert.match(cutover, /canAccessCorporateFinance/, 'corporate finance denial must stay asserted')
    assert.match(cutover, /canEditFinanceBooks/, 'the read-only guarantee must stay asserted')
    assert.match(cutover, /filterFinanceBranchOptions/, 'HQ must stay hidden from the investor branch list')
  })

  it('stays wired into the readiness orchestrator as a critical step', () => {
    // A critical gate that quietly stops running is the same failure wearing a
    // different hat: the readiness number goes up and nothing checks it.
    const orchestrator = read('scripts/e2e-ultimate-readiness.mjs')
    const step = orchestrator.slice(orchestrator.indexOf("id: 'L8'"), orchestrator.indexOf("id: 'L8'") + 220)
    assert.match(step, /e2e-ops-cutover|e2e:cutover/, 'L8 must still run the cutover gate')
    assert.match(step, /critical:\s*true/, 'L8 must stay critical')
  })
})