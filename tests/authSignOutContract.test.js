import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The session must be revoked, not merely forgotten.
 *
 * The client is configured `persistSession: true, autoRefreshToken: true` on
 * localStorage. That combination means a storage scrub is *not* a sign-out: the
 * live client keeps its in-memory session and its refresh timer, the refresh
 * token it needs is already gone, and the next request can go out carrying an
 * expired access token. BUG-067 is the open, unreproduced instance of exactly
 * that state — the QA harness's `clearSession` performs the scrub, and this
 * test exists so the product never grows the same path by accident.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

/** Comments are stripped first: prose naming the hazard satisfies a grep for it. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function sourceFiles(dir = join(root, 'src')) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(js|jsx)$/.test(entry)) out.push(full)
  }
  return out
}

describe('signing out must revoke the session, not just forget it', () => {
  const provider = stripComments(read('src/auth/AuthProvider.jsx'))

  it('revokes server-side with a local fallback', () => {
    assert.match(
      provider,
      /supabase\.auth\.signOut\(\{\s*scope:\s*'global'\s*\}\)/,
      'signOut must revoke the refresh token globally so other tabs/devices drop too',
    )
    assert.match(
      provider,
      /scope:\s*'local'/,
      'a local fallback must exist for when the global revoke fails',
    )
  })

  it('clears the in-memory session and profile', () => {
    // Revoking alone is not enough while the provider keeps handing the old
    // identity to the route guards.
    const body = provider.slice(provider.indexOf('const signOut = useCallback'))
    assert.match(body, /setSession\(null\)/, 'the session must be dropped from state')
    assert.match(body, /setProfile\(null\)/, 'the profile must be dropped from state')
  })

  it('removes the realtime channel when the identity changes', () => {
    // A channel left subscribed under the previous user keeps asking for data
    // the next one is not entitled to, with the previous user's credentials.
    assert.match(provider, /supabase\.removeChannel\(channel\)/, 'the channel must be torn down')
    const effect = provider.slice(
      provider.lastIndexOf('supabase.removeChannel(channel)') - 2000,
      provider.indexOf('}, [session?.user?.id'),
    )
    assert.match(effect, /removeChannel/, 'the teardown must belong to the session-keyed effect')
  })

  it('is running with auto-refresh, which is what makes a bare scrub unsafe', () => {
    const client = stripComments(read('src/lib/supabase.js'))
    assert.match(client, /autoRefreshToken:\s*true/, 'auto-refresh must be on for this hazard to be real')
    assert.match(client, /persistSession:\s*true/, 'the session must be persisted for this hazard to be real')
    assert.match(client, /storage:\s*typeof window !== 'undefined' \? window\.localStorage/, 'it must persist to localStorage')
  })

  it('no product code path clears the whole storage the way the harness does', () => {
    // The guard that matters: a single blanket clear anywhere in src/ would
    // reproduce the harness's unsafe sign-out for every real user.
    const files = sourceFiles()
    assert.ok(files.length > 50, `expected a real source tree, found ${files.length} files`)
    const offenders = []
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'))
      if (/localStorage\s*\.\s*clear\s*\(/.test(code) || /sessionStorage\s*\.\s*clear\s*\(/.test(code)) {
        offenders.push(file.replace(root, '.'))
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `a blanket storage clear logs the user out without revoking the session: ${offenders.join(', ')}`,
    )
  })
})