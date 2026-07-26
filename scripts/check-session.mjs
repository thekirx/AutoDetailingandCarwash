/**
 * Session management invariants + docs presence.
 * node scripts/check-session.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const session = read('src/lib/session.js')
assert.match(session, /refreshSessionSingleFlight/)
assert.match(session, /ensureFreshAccessToken/)
assert.match(session, /shouldReloadProfile/)

const token = read('src/lib/authToken.js')
assert.match(token, /ensureFreshAccessToken/)

const supabase = read('src/lib/supabase.js')
assert.match(supabase, /flowType: 'pkce'/)
assert.match(supabase, /autoRefreshToken: true/)
assert.doesNotMatch(supabase, /storageKey:/)

const auth = read('src/auth/AuthProvider.jsx')
assert.match(auth, /shouldReloadProfile/)
assert.match(auth, /visibilitychange/)
assert.match(auth, /scope: 'local'/)

console.log('check-session: ok')
