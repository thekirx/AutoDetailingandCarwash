import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * check:sheet-ui phase 2 reported "the POS summary did not render" when the
 * Branch Admin had never signed in at all.
 *
 * The cause was a swallowed timeout:
 *
 *   waitForFunction(...).catch(() => null)
 *
 * When the sign-in did not complete, the script walked on to posTarget, was
 * bounced back to /operations/login, and scraped zero rows. Every signal then
 * pointed away from the truth — dbSheet=true said the data was fine,
 * renderedRows=0 said the page was broken, "page errors: (none)" said nothing
 * threw. The evidence screenshot showed an empty login form.
 *
 * That is the same unactionable shape as the bare admin.console 401s in
 * BUG-067: a failure that names the wrong thing. A reader sent to the
 * rendering layer spends hours on a page that was never the problem — which is
 * how a transient sign-in sat looking like a data defect.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'scripts/check-sheet-ui.mjs'), 'utf8')

describe('the till phase names a sign-in failure as a sign-in failure', () => {
  it('checks the URL after the swallowed wait', () => {
    assert.match(src, /signedInUrl\.includes\('\/operations\/login'\)/, 'the sign-in result is never inspected')
  })

  it('says so in words, not just by exiting non-zero', () => {
    assert.match(src, /Branch Admin never reached the POS/)
    assert.match(src, /SIGN-IN failure, not a rendering or data failure/)
  })

  it('still swallows the wait — the attribution, not the flow, is the fix', () => {
    // Aborting on the timeout would be a different behaviour change. The point
    // is that a swallowed failure is now NAMED rather than silently becoming a
    // rendering complaint.
    assert.match(src, /location\.pathname\.startsWith\('\/operations'\)[\s\S]{0,200}?\.catch\(\(\) => null\)/)
  })

  it('does not report two failures for one fault', () => {
    // phase2Failed suppresses the follow-on "did not render" line. Two failures
    // for one cause reads as two causes and sends the reader looking for a
    // rendering bug that is not there.
    assert.match(src, /if \(phase2Failed\)/)
    assert.match(src, /skipping the rendering comparison/)
  })

  it('prints the error text the page itself displayed when the form did complain', () => {
    // Without this the operator has to open the screenshot to learn anything.
    assert.match(src, /page said:/)
  })

  it('reports the final URL on a genuine rendering failure too', () => {
    assert.match(src, /final url:/)
  })
})