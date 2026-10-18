import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * BUG-083 — customer history on the Team Lead queue always 401s, and hides it.
 *
 * `TeamLeadQueuePage.jsx` called the history endpoint with no headers at all:
 *
 *   const res = await fetch(`/api/customer-history?${params}`)
 *
 * `server/customerHistoryApi.mjs:72-73` takes the caller from the bearer token
 * and nothing else — `bearer()` in httpUtil reads the Authorization header and
 * has no cookie fallback — so every call answered 401 Unauthorized.
 *
 * The failure is invisible because line 424 falls back to querying
 * `operations_queue_board` directly. The panel therefore kept rendering, so the
 * role-QA wave saw a healthy page: it opens routes and checks RBAC, it does not
 * type a plate into a search box. But the fallback is a DIFFERENT dataset — open
 * queue rows, not visits — so it has no `final_price_minor`, no `service_name`
 * and no `visit_group_id`. A Team Lead looking up a car that visited last month
 * gets nothing, and nothing tells them why.
 *
 * That is the shape of bug worth catching: not a red screen, but a green screen
 * showing the wrong rows. Found by auditing every /api/* fetch for a missing
 * Authorization header — 11 of 56 calls had none, 10 of those are public
 * endpoints by design (booking, sign-in, sign-up, contact form, plate lookup),
 * and this was the only staff one.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(join(root, 'src/pages/TeamLeadQueuePage.jsx'), 'utf8')
const server = readFileSync(join(root, 'server/customerHistoryApi.mjs'), 'utf8')

/** The exact fetch call, so an unrelated fetch in the file cannot satisfy this. */
function historyFetchArgs() {
  const at = page.indexOf('fetch(`/api/customer-history')
  assert.ok(at > -1, 'the customer-history fetch is gone — this file no longer describes it')
  const open = page.indexOf('(', at)
  let depth = 0
  for (let i = open; i < page.length; i++) {
    const ch = page[i]
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') {
      depth--
      if (depth === 0) return page.slice(open + 1, i)
    }
  }
  return ''
}

describe('the Team Lead customer-history call authenticates', () => {
  it('sends an Authorization header', () => {
    const args = historyFetchArgs()
    assert.match(
      args,
      /\bAuthorization\b/,
      `customer-history is called with no Authorization header, so the API answers 401 every time:\n${args}`,
    )
  })

  it('sends a fresh token rather than a cached one', () => {
    // A stale token is a 401 too, and a less obvious one. The app already has
    // getAccessTokenFresh() for exactly this, and every other authenticated
    // /api/* call in the app uses it.
    //
    // Asserted over the surrounding function, not the fetch arguments: the token
    // is awaited on the line BEFORE the call, because you cannot await inside an
    // argument list. Checking the args alone would have failed a correct fix.
    const at = page.indexOf('fetch(`/api/customer-history')
    const before = page.slice(Math.max(0, at - 900), at)
    assert.match(
      before,
      /await getAccessTokenFresh\(\)/,
      'the token must be refreshed at call time; a captured one expires mid-shift',
    )
    assert.match(
      historyFetchArgs(),
      /\$\{token\}/,
      'the header must interpolate the token that was just fetched',
    )
  })
})

describe('the endpoint still refuses an anonymous caller', () => {
  // The client-side fix must not tempt anyone into loosening this. Customer
  // history is staff-only data; an endpoint that stops requiring a token would
  // be a worse bug than the 401.
  it('the handler 401s when no bearer token is present', () => {
    assert.match(server, /const token = bearer\(req\)/)
    assert.match(server, /if \(!token\) return json\(res, 401/)
  })
})

describe('no staff-facing /api/* fetch forgot its Authorization header', () => {
  // The sweep that found BUG-083. Eleven of 56 /api/* fetches carried no
  // Authorization header and ten of those are public endpoints by design:
  // booking, customer sign-in, sign-up, the contact form and plate lookup. This
  // pins that list, so the next endpoint added to the public set has to be
  // listed deliberately rather than appearing because nobody checked.
  //
  // The scan below tracks brace depth rather than slicing to the first `}`.
  // Slicing to the first brace is not "the end of the object" — it lands inside
  // a nested `headers: { ... }` literal and reports a correct authenticated call
  // as anonymous. That mistake produced five false positives before it was
  // caught, including src/lib/maintenanceSchedulesClient.js.
  const PUBLIC = new Set([
    '/api/public-inquiry',
    '/api/public-book',
    '/api/customer-auth-lookup',
    '/api/customer-signup',
    '/api/notify-ops-form',
    '/api/plate-lookup',
    // One-click demo sign-in for testing. Unauthenticated by definition — the
    // point is to obtain a session without one. It 404s without the QA key,
    // only ever signs in a fixed set of known demo accounts, and returns no
    // credential. Recorded on BUG-088.
    '/api/demo-login',
    // Refer a friend: GET returns the program settings, or an inviter's first
    // name for a valid code (rate limited). The POS POST sends a bearer.
    '/api/referral',
  ])

  it('every fetch to an /api/* route outside the public list carries a bearer token', () => {
    const offenders = []
    const walk = (dir, prefix = '') => {
      for (const rel of readdirSync(join(dir, prefix), { withFileTypes: true })) {
        const relPath = join(prefix, rel.name)
        if (rel.isDirectory()) {
          walk(dir, relPath)
          continue
        }
        if (!/\.(js|jsx)$/.test(rel.name)) continue
        const text = readFileSync(join(dir, relPath), 'utf8')
        const re = /\bfetch\s*\(/g
        let m
        while ((m = re.exec(text))) {
          const open = text.indexOf('(', m.index)
          let depth = 0
          let end = -1
          for (let i = open; i < text.length; i++) {
            const ch = text[i]
            if (ch === '(' || ch === '{' || ch === '[') depth++
            else if (ch === ')' || ch === '}' || ch === ']') {
              depth--
              if (depth === 0) {
                end = i
                break
              }
            }
          }
          if (end < 0) continue
          const args = text.slice(open + 1, end)
          const url = /^\s*[`'"]([^`'"]+)/.exec(args)?.[1]
          if (!url || !url.startsWith('/api/')) continue
          const route = url.split('?')[0]
          if (PUBLIC.has(route)) continue
          if (/\bauthorization\b/i.test(args)) continue
          offenders.push(`src/${relPath}:${text.slice(0, m.index).split('\n').length} ${url}`)
        }
      }
    }
    walk(join(root, 'src'))
    assert.deepEqual(offenders, [], `staff-facing fetches with no Authorization header:\n${offenders.join('\n')}`)
  })
})

describe('the open-queue fallback is a fallback, not the normal path', () => {
  it('the board query is only reachable after the API answer is not usable', () => {
    const at = page.indexOf("supabase.from('operations_queue_board')")
    assert.ok(at > -1, 'the fallback is gone')
    const before = page.slice(Math.max(0, at - 1400), at)
    assert.match(
      before,
      /if \(res\.ok\)/,
      'the board query must sit behind the API response check, or it silently replaces history with queue rows',
    )
  })
})