/**
 * One-click demo sign-in, client half.
 *
 * The browser holds an account ID and nothing else. It posts the ID to
 * /api/demo-login, the server reads the password from its own environment and
 * performs the sign-in, and only the session comes back.
 *
 * This function deliberately has no idea what a password is. It used to fill the
 * real sign-in form with `a.password`, which meant the client had to read
 * `VITE_DEMO_PASSWORD_*` — and a computed `env[name]` lookup is invisible to
 * Vite's per-key replacement, so the whole env object (all 15 staff passwords)
 * was inlined into the deployed bundle. That was the half of BUG-088 the source
 * scrub did not close.
 */
export async function demoSignIn(accountId) {
  const res = await fetch('/api/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: accountId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Demo sign-in failed')
  return data
}