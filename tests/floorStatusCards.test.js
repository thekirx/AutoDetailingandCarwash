import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { operationsQueueHref, parseQueueLaneParam } from '../src/queue/queueLogic.js'
import { isDemoLoginEnabled } from '../src/lib/demoLogin.js'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
const envProd = existsSync(join(root, '.env.production')) ? readFileSync(join(root, '.env.production'), 'utf8') : ''
const opsLoginPage = readFileSync(join(root, 'src/pages/LoginPage.jsx'), 'utf8')
const customerLoginPage = readFileSync(join(root, 'src/pages/CustomerSignInPage.jsx'), 'utf8')

describe('Floor status cards → queue lanes', () => {
  it('parses lane query and builds queue hrefs', () => {
    assert.equal(parseQueueLaneParam('waiting'), 'waiting')
    assert.equal(parseQueueLaneParam('in_progress'), 'in_progress')
    assert.equal(parseQueueLaneParam('final_checking'), 'final_checking')
    assert.equal(parseQueueLaneParam('redo'), 'redo')
    // for_payment is now a real lane for console-tier roles (legacy TL port)
    assert.equal(parseQueueLaneParam('for_payment'), 'for_payment')
    assert.equal(parseQueueLaneParam('all'), null)
    assert.equal(operationsQueueHref({ lane: 'waiting', branch: 'bacoor' }), '/operations/queue?lane=waiting&branch=bacoor')
    assert.equal(operationsQueueHref({ lane: 'total' }), '/operations/queue')
    assert.equal(operationsQueueHref({ branch: 'all' }), '/operations/queue')
  })

  it('dashboard status MetricCards link into the queue board when the viewer may open it', () => {
    assert.match(page, /queueLink\(\{ lane: 'waiting'/)
    assert.match(page, /queueLink\(\{ lane: 'in_progress'/)
    assert.match(page, /queueLink\(\{ lane: 'final_checking'/)
    assert.match(page, /allowRoute\(profile, 'queue'\) \? operationsQueueHref\(opts\) : undefined/)
    assert.match(page, /floor-metric-card-link/)
    assert.match(page, /Jump to waiting lane/)
  })

  it('queue board focuses lanes from headers (no redundant status cards)', () => {
    assert.doesNotMatch(page, /floor-status-chips/)
    assert.match(page, /setLaneFilter/)
    assert.match(page, /queue-lane-focused/)
    assert.match(page, /queue-lane-count/)
    assert.match(page, /parseQueueLaneParam/)
    assert.match(page, /useSearchParams/)
    assert.match(page, /Show all lanes/)
  })
})

describe('Vercel demo login visibility', () => {
  // Production runs on *.vercel.app. The chips are OFF there by default; the
  // owner turned them back on 2026-10-12 for testing, which is a build-time
  // env var set in the Vercel project — deliberately, never in the repo. What
  // still has to hold regardless is that the repo cannot enable it by accident.
  it('the repo cannot turn demo sign-in on by itself', () => {
    assert.doesNotMatch(envProd, /VITE_ENABLE_DEMO_LOGIN\s*=\s*true/i, 'a committed .env.production enabling it is the BUG-088 shape')
    assert.equal(isDemoLoginEnabled({ dev: false }), false, 'no flag and not dev means off')
    assert.equal(isDemoLoginEnabled({ dev: true }), true)
  })

  it('enabling it exposes buttons, never secrets', () => {
    // This is the part that makes the accepted risk survivable: the demo accounts
    // carry `passwordEnv` and read the value at use time, so no credential is in
    // the bundle even with the chips on.
    const src = readFileSync(join(root, 'src/lib/demoAccounts.js'), 'utf8')
    assert.doesNotMatch(src, /password:\s*['"`]/, 'a literal password is back in demoAccounts.js')
    for (const a of [...OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT]) {
      assert.match(a.passwordEnv || '', /^VITE_DEMO_PASSWORD_[A-Z0-9]+$/, `${a.id} has no password env var`)
    }
  })

  it('demo chip title does not leak password in tooltip', () => {
    const src = readFileSync(join(root, 'src/components/DemoAccountChips.jsx'), 'utf8')
    assert.doesNotMatch(src, /title=\{`\$\{a\.email\}\$\{a\.password/)
    assert.match(src, /title=\{a\.email \|\| a\.label\}/)
    assert.match(src, /disabled=\{disabled\}/)
  })

  it('demo chips sign in on both login pages, through the server', () => {
    // CHANGED 2026-10-12: the chips no longer fill the form with `a.password`.
    // They post an account id to /api/demo-login and adopt the returned session,
    // because a client-held password is a credential in the deployed bundle.
    for (const page of [opsLoginPage, customerLoginPage]) {
      assert.match(page, /demoSignIn\(a\.id\)/, 'a chip must sign in through the server endpoint')
      assert.match(page, /supabase\.auth\.setSession\(\{ access_token, refresh_token \}\)/, 'the returned session must be adopted')
      assert.doesNotMatch(page, /setPassword\(a\.password\)/, 'a chip must never put a password into the form')
    }
    assert.match(opsLoginPage, /const signInWithCredentials = async/, 'typed sign-in still works')
    assert.match(opsLoginPage, /disabled=\{submitting\}/)
    assert.match(customerLoginPage, /const signInWithCredentials = async/)
    assert.match(customerLoginPage, /skipIntentCheck = false/)
    assert.match(customerLoginPage, /disabled=\{submitting\}/)
  })

  it('a chip lands every role on its OWN home, not one hard-coded page', () => {
    // Regression, found by clicking a second role rather than the one that
    // happened to work. Sending everyone to /operations/dashboard passes for
    // Admin (they can open it) and dead-ends a Team Lead on access-denied.
    // /operations resolves per role through OpsIndexRedirect.
    assert.match(opsLoginPage, /window\.location\.assign\('\/operations'\)/)
    assert.doesNotMatch(opsLoginPage, /window\.location\.assign\('\/operations\/dashboard'\)/)
    assert.match(readFileSync(join(root, 'src/App.jsx'), 'utf8'), /<Route index element=\{<OpsIndexRedirect \/>\}/)
  })
})
