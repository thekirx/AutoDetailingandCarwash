import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { resolveBroadcastAudience } from '../server/broadcastAudience.mjs'

/**
 * A broadcast composer offering "One branch" must never fall through to
 * "everyone".
 *
 * The server gates the branch audience on `targetAudience === 'branch' &&
 * branchSlug`. When the operator picks "One branch" and does not pick a branch,
 * `branch_slug` is `''`, the compound condition is false, the detailing/wash
 * branches are false too, and `custQuery` is left unfiltered — so the send
 * targets **every customer in the company** while the screen still says "One
 * branch". Nothing errors and nothing warns; the only trace is a history row
 * showing `branch` with no slug beside it.
 *
 * The behaviour to match is not invented: the reminder form higher up the SAME
 * page already does this correctly —
 *
 *   if (needsBranch && !draft.branch_slug) { toast.error('Pick a branch.'); return }
 *
 * so the sibling form simply was not given the check. With channel `sms` the
 * same fall-through texts the whole customer base.
 */

describe('resolveBroadcastAudience refuses an unscoped branch send', () => {
  it('accepts a branch send that names a branch', () => {
    // The control: without it, "refuse everything" would satisfy the rest.
    assert.deepEqual(resolveBroadcastAudience('branch', 'bacoor'), { ok: true, audience: 'branch', branchSlug: 'bacoor' })
  })

  it('accepts the audiences that need no sub-selection', () => {
    assert.deepEqual(resolveBroadcastAudience('all', null), { ok: true, audience: 'all', branchSlug: null })
    assert.deepEqual(resolveBroadcastAudience('wash', null), { ok: true, audience: 'wash', branchSlug: null })
    assert.deepEqual(resolveBroadcastAudience('detailing', null), { ok: true, audience: 'detailing', branchSlug: null })
  })

  it('refuses "One branch" with no branch, instead of widening to everyone', () => {
    for (const slug of [null, undefined, '', '   ']) {
      const r = resolveBroadcastAudience('branch', slug)
      assert.equal(r.ok, false, `slug ${JSON.stringify(slug)} was accepted and would have sent to every customer`)
      assert.match(r.error, /branch/i, 'the error must name what is missing')
    }
  })

  it('still defaults an unrecognised audience to all', () => {
    // Unchanged on purpose: an unknown value was always 'all', and widening
    // that here would be a different decision than the one being made. What
    // must never happen is 'branch' silently becoming 'all'.
    assert.deepEqual(resolveBroadcastAudience('nonsense', null), { ok: true, audience: 'all', branchSlug: null })
  })

  it('the handler returns the refusal instead of dropping the filter', () => {
    // A pure function nobody wires is not a control, so check the call site too.
    const src = readFileSync(new URL('../server/notificationBroadcastApi.mjs', import.meta.url), 'utf8')
    assert.match(src, /resolveBroadcastAudience\(body\.target_audience/, 'the handler must consult the resolver')
    assert.match(
      src,
      // Wide window on purpose: this asserts the refusal returns a 400, not how
      // much prose sits between the check and the return.
      /if \(!resolved\.ok\)[\s\S]{0,400}?return json\(res, 400/,
      'an unscoped branch send must be refused with a 400, not sent',
    )
    assert.doesNotMatch(
      src,
      /targetAudience === 'branch' && branchSlug/,
      'the compound guard is what silently widens to every customer; it must be gone',
    )
  })

  it('the composer refuses to submit before the branch is picked', () => {
    // The same check the reminder form above it already has.
    const src = readFileSync(new URL('../src/pages/NotificationsPage.jsx', import.meta.url), 'utf8')
    assert.match(
      src,
      /form\.target_audience === 'branch' && !form\.branch_slug[\s\S]{0,160}?return/,
      'the broadcast composer must not post a branch send with no branch picked',
    )
  })
})