/**
 * Every `/api/*` path the app calls must actually resolve in production.
 *
 * This is the BUG-048 guard. `/api/public-inquiry` and `/api/data-center`
 * returned 404 on production because the client called a path that neither a
 * serverless function nor a `vercel.json` rewrite served. Nothing failed at
 * build time, nothing failed at lint time, and the unit suite was green the
 * whole time — the break only existed on the deployed host.
 *
 * The failure mode is quiet and expensive: a feature that looks wired in the
 * source is simply absent in production. `src/lib/push.js` posting to
 * `/api/push-subscribe` looks correct in isolation and is, but only because a
 * rewrite maps it onto `/api/notifications?operation=push-subscribe`. Delete
 * that one line of JSON and push enrolment 404s for every member of staff.
 *
 * A path resolves in production if EITHER:
 *   - a serverless function exists at api/<name>.js, OR
 *   - vercel.json has a rewrite whose source is that exact path
 * Anything else is a 404 waiting to happen.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

function walk(dir, acc = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) walk(rel, acc)
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) acc.push(rel)
  }
  return acc
}

const vercel = JSON.parse(read('vercel.json'))
const rewrites = new Map(
  (vercel.rewrites || [])
    .filter((r) => r.source?.startsWith('/api/'))
    .map((r) => [r.source, r.destination]),
)
const functions = new Set(
  (existsSync(join(root, 'api')) ? readdirSync(join(root, 'api')) : [])
    .filter((f) => f.endsWith('.js'))
    .map((f) => `/api/${f.replace(/\.js$/, '')}`),
)

/** Every `/api/<name>` literal the app calls against ITS OWN host, and where from. */
function calledPaths() {
  const found = new Map()
  // src/ and api/ are the request surface this app controls. server/ is
  // deliberately NOT scanned: outbound integrations carry their own `/api/`
  // namespace (BusyBee BrandTxT posts to `${baseUrl}/api/v2/SendSMS`), which is
  // a different API on a different host and nothing here can route it.
  for (const dir of ['src', 'api']) {
    for (const file of walk(dir)) {
      // Comments must go first, so header prose is not mistaken for a route.
      const src = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      for (const m of src.matchAll(/["'`](\/api\/[a-z0-9-]+)/gi)) {
        const p = m[1]
        if (!found.has(p)) found.set(p, [])
        if (!found.get(p).includes(file)) found.get(p).push(file)
      }
    }
  }
  return found
}

test('every /api path the app calls resolves to a function or a rewrite', () => {
  const called = calledPaths()
  assert.ok(called.size > 0, 'the scan must find /api paths, or it is not scanning anything')

  const unresolved = []
  for (const [path, where] of called) {
    if (!rewrites.has(path) && !functions.has(path)) {
      unresolved.push(`${path}  (called from ${[...new Set(where)].join(', ')})`)
    }
  }
  assert.deepEqual(
    unresolved, [],
    'these paths 404 in production: no api/<name>.js and no vercel.json rewrite with that exact source',
  )
})

test('the routes BUG-048 broke are still routed', () => {
  // Named explicitly as well as covered generically above: if this fails, the
  // specific production outage is back, and the message should say so rather
  // than just listing a path.
  for (const p of ['/api/public-inquiry', '/api/data-center', '/api/push-subscribe', '/api/send-push']) {
    assert.ok(
      rewrites.has(p) || functions.has(p),
      `${p} no longer resolves — this is the BUG-048 outage recurring`,
    )
  }
})

test('a gateway that shadows its own rewrite declares a default operation', () => {
  // This is the BUG-048 bug itself, stated precisely.
  //
  // vercel.json rewrites `/api/public-inquiry` to `/api/customer?operation=public-inquiry`.
  // But `api/public-inquiry.js` ALSO exists, and a serverless file at that exact
  // path wins over the rewrite. So a request to the bare path arrives at
  // public-inquiry.js with no `?operation`, and a gateway without a
  // defaultOperation answers 404. Nothing in the repo showed the break: the
  // rewrite was present and correct, and the unit suite stayed green.
  //
  // The fix was `{ defaultOperation }` on the two gateways that shadow a
  // rewrite. This asserts that invariant for every gateway, so the next
  // `api/<name>.js` that lands on a rewritten path cannot repeat it.
  const shadowed = [...rewrites.keys()].filter((source) => functions.has(source))
  for (const source of shadowed) {
    const file = `${source.replace(/^\//, '')}.js`
    const src = read(file)
    assert.match(
      src,
      /defaultOperation\s*:/,
      `${source} has a vercel.json rewrite AND api/${source.replace('/api/', '')}.js exists, ` +
      'so the function shadows the rewrite and must declare a defaultOperation (BUG-048)',
    )
  }
  // The two known cases must be covered, or this test is guarding nothing.
  assert.ok(
    shadowed.includes('/api/public-inquiry') && shadowed.includes('/api/data-center'),
    `expected public-inquiry and data-center to shadow their rewrites, saw ${JSON.stringify(shadowed)}`,
  )
})

test('every rewrite destination points at a real gateway operation', () => {
  // A rewrite to /api/notifications?operation=push-subscribe is only correct if
  // `api/notifications.js` exports that operation. Renaming an operation in the
  // gateway leaves the rewrite pointing at nothing, and it fails only in
  // production with a generic 400.
  for (const [source, destination] of rewrites) {
    const url = new URL(destination, 'https://x')
    const file = url.pathname.replace(/^\//, '')
    if (!file.startsWith('api/')) continue
    const src = read(`${file.replace(/\.js$/, '')}.js`)
    const op = url.searchParams.get('operation')
    if (!op) continue
    // Keys are written both ways in these gateways: `busybee:` unquoted, and
    // `'push-subscribe':` quoted only because of the hyphen. Match either, or
    // the check reports a false failure on every unquoted key.
    const re = new RegExp(`(^|[\\s{,])['"\`]?${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]?\\s*:`, 'm')
    assert.ok(
      re.test(src),
      `${source} rewrites to ${destination}, but api/${file.split('/').pop()} exports no '${op}' operation`,
    )
  }
})