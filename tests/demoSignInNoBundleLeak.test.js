import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The owner asked for one-click demo sign-in on the deployed site (2026-10-12),
 * and agreed to it after being shown the risk. Building it honestly surfaced
 * something nobody had measured: turning the chips on put **all 15 staff
 * passwords** into the deployed bundle, not just into the repo.
 *
 * The mechanism was `demoPassword()`, which read `import.meta.env` and indexed it
 * with a computed key (`env[name]`). Vite replaces `import.meta.env` per-key when
 * it can see the key; with a computed one it cannot, so it inlines the whole
 * object — every VITE_-prefixed variable, which is every staff password.
 *
 * So the rule these tests pin is not "the repo has no passwords" (a test has
 * asserted that since BUG-088). It is: **the client bundle must never contain a
 * password, no matter how demo sign-in is enabled.** Those are different
 * properties, and only one of them was being tested.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

/**
 * Every check below is about CODE. These files carry long comments that name the
 * exact strings they forbid — "must never touch `import.meta.env`" is in
 * demoAccounts.js — so matching raw text fails on the explanation of the rule
 * rather than a violation of it. Line comments first, then block comments.
 */
const code = (p) => read(p).replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('demo sign-in does not put a password in the client bundle', () => {
  it('demoPassword never reaches for import.meta.env', () => {
    // This is the exact cause. Vite cannot see through a computed key, so any
    // `import.meta.env` object access here inlines the whole env into dist.
    const src = code('src/lib/demoAccounts.js')
    assert.doesNotMatch(
      src,
      /import\.meta\.env/,
      'demoAccounts.js is in the client graph; touching import.meta.env there re-inlines every VITE_ var',
    )
  })

  it('the chip click posts an id to the server, never a password', () => {
    for (const page of ['src/pages/LoginPage.jsx', 'src/pages/CustomerSignInPage.jsx']) {
      const src = read(page)
      assert.doesNotMatch(
        src,
        /setPassword\(a\.password\)|signInWithCredentials\(a\.email,\s*a\.password/,
        `${page} still signs in with a client-held password`,
      )
      assert.match(src, /demoSignIn\(a\.id\)/, `${page} does not use the server-side demo sign-in`)
    }
  })

  it('the client helper sends only an account id', () => {
    const src = code('src/lib/demoSignIn.js')
    assert.match(src, /JSON\.stringify\(\{ id: accountId \}\)/, 'the request must carry the id and nothing else')
    assert.doesNotMatch(src, /password/i, 'the client half of demo sign-in has no business naming a password')
  })

  it('no credential is reachable from the module the chips import', () => {
    const src = read('src/lib/demoAccounts.js')
    assert.doesNotMatch(src, /Hakum[A-Z][A-Za-z]*20\d\d!/, 'a literal password is back in demoAccounts.js')
    assert.match(src, /passwordEnv:/, 'accounts name the server-side var instead of carrying a value')
  })
})

describe('the demo sign-in endpoint', () => {
  it('reads the password server-side and never sends one back', () => {
    const src = code('server/demoLoginApi.mjs')
    assert.match(src, /process\.env\[account\.passwordEnv\]/, 'the server must read the password from its own env')
    assert.doesNotMatch(src, /import\.meta\.env/, 'a server module must never touch import.meta.env')
    // The response shape is the whole point: tokens and an email, no secret.
    const body = src.slice(src.indexOf('return json(res, 200'))
    assert.doesNotMatch(body, /password/, 'the 200 response must not contain the password it just used')
    assert.match(body, /access_token/)
    assert.match(body, /refresh_token/)
  })

  it('is a 404 when the deployment has not opted in', () => {
    // 404 rather than 403: switched off, the route should not advertise itself.
    const src = read('server/demoLoginApi.mjs')
    assert.match(src, /!demoLoginEnabled\(\)\) return json\(res, 404/)
  })

  it('is routed in both dev and production', () => {
    assert.match(read('vercel.json'), /\/api\/demo-login/, 'Vercel has no route to it')
    assert.match(read('vite.config.js'), /\/api\/demo-login/, 'npm run dev has no route to it, so testing breaks')
    assert.match(read('api/demo-login.js'), /demo-login/)
  })

  it('opt-in is a value, never a hostname', () => {
    // BUG-088 was `hostname.endsWith('vercel.app')`. It read as harmless and
    // enabled itself on deploy. There must be no host logic in any code path.
    // Matched on comment-stripped source: both files name the word in prose.
    for (const p of ['src/lib/demoLogin.js', 'server/demoLoginApi.mjs']) {
      assert.doesNotMatch(code(p), /hostname|location\.host/, `${p} decides from the host again`)
    }
  })
})