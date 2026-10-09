/**
 * Auth-failure recorder for the QA harnesses.
 *
 * Console/page errors seen since the last reset. A role can render "successfully"
 * while the page throws behind it, so every navigation reports its own bucket.
 *
 * A bare "401" is not actionable. The wave walks a dozen dock routes before it
 * reports, so each error has to carry the route it was seen on — otherwise a
 * failure names a role but not the call that failed. This is the difference
 * between BUG-064 (a red wave nobody could act on) and a diagnosable one.
 *
 * The console message for a failed fetch is always the same useless string —
 * "Failed to load resource: the server responded with a status of 401" — and it
 * names neither the URL nor the status, so we listen on the wire. Scoped to
 * 401/403 on purpose: widening it to every 4xx/5xx drags in dev-server 404s that
 * are not product faults and turns a diagnostic into noise.
 *
 * URL + status still cannot separate the two hypotheses that matter for BUG-067:
 * a request that went out carrying somebody's stale token, versus one that went
 * out with no token at all. Those need completely different fixes, so the method
 * and whether an Authorization header was attached are recorded too. The token is
 * never logged — only a short digest, which is enough to tell "still persona A's
 * token" from "no token" without writing a credential into the evidence file.
 */
import { createHash } from 'node:crypto'

export function collectErrors(page) {
  const bucket = []
  const where = () => {
    try {
      return new URL(page.url()).pathname
    } catch {
      return String(page.url())
    }
  }
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    // Chrome prints one of these per failed fetch, and it is always the same
    // sentence — it names neither the URL nor the method. The `response`
    // listener below records the same failure with all three, so keeping this
    // one just means every auth fault is reported twice and the report the
    // persona actually sees leads with the useless copy. Only the 401/403 form
    // is dropped; a 404 or 500 console line still comes through.
    if (/Failed to load resource.*\b(401|403)\b/i.test(text)) return
    bucket.push(`console @${where()}: ${text.slice(0, 300)}`)
  })
  page.on('pageerror', (err) => bucket.push(`pageerror @${where()}: ${String(err?.message || err).slice(0, 300)}`))
  page.on('response', (res) => {
    const status = res.status()
    if (status !== 401 && status !== 403) return
    let method = '?'
    let fp = 'none'
    try {
      const req = res.request()
      method = req.method()
      const headers = req.headers() || {}
      const auth = headers.authorization || headers.Authorization || ''
      fp = auth ? createHash('sha256').update(String(auth)).digest('hex').slice(0, 8) : 'none'
    } catch {
      /* a response whose request is no longer resolvable still names its status */
    }
    bucket.push(`http ${status} ${method} @${where()} ${res.url().slice(0, 300)} [auth:${fp}]`)
  })
  return {
    take: () => bucket.splice(0, bucket.length),
  }
}