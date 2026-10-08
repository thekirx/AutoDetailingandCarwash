/**
 * Navigation-tolerant `page.evaluate`.
 *
 * Puppeteer throws "Execution context was destroyed" whenever a route guard
 * redirects while an evaluate is in flight. That is a race in the TEST, not a
 * fault in the product, and letting it escape is how a passing app produces a
 * red gate: the unguarded call unwound to the harness's top-level
 * `fail('fatal')`, which aborted the run and silently dropped every remaining
 * check for that persona. One such race turned a 179/179 wave into 166/169.
 *
 * A QA gate that fails spuriously is worse than no gate, because it teaches
 * people to ignore it. Retry against the page that is actually loaded now, and
 * only rethrow errors that are not the race.
 *
 * Extracted to its own module so the tests exercise the real implementation
 * against a real browser rather than a copy that can drift from it.
 */

const RACE = /Execution context was destroyed|Cannot find context|Target closed|Frame was detached|Inspected target navigated or closed/i

export const isNavigationRace = (err) => RACE.test(String(err?.message || err))

export async function safeEvaluate(page, fn, settle = null) {
  let last = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await page.evaluate(fn)
    } catch (err) {
      if (!isNavigationRace(err)) throw err
      last = err
      // Bounded: if the navigation already landed there is nothing to wait for,
      // and blocking a full timeout on every retry would make a slow gate
      // slower. The settle callback owns the real readiness check.
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null),
        new Promise((r) => setTimeout(r, 500)),
      ])
      if (settle) await settle()
      else await new Promise((r) => setTimeout(r, 400))
    }
  }
  throw new Error(`evaluate lost its execution context 3x: ${last?.message || last}`)
}