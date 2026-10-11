/**
 * What a broadcast is allowed to target.
 *
 * The composer offers "One branch", which is narrower than "All customers" by
 * the operator's understanding and by the label on screen. The handler used to
 * express that as one compound condition:
 *
 *   if (targetAudience === 'branch' && branchSlug) { ...filter... }
 *
 * Pick "One branch", do not pick a branch, and `branch_slug` is `''`, so the
 * condition is false — as are the detailing/wash branches — and the query is
 * left unfiltered. The screen still says "One branch" and every customer in the
 * company is messaged. Nothing errors, nothing warns. With channel `sms` that
 * is the whole customer base on the meter.
 *
 * The correct behaviour was already established on the same page: the reminder
 * form refuses to save with `if (needsBranch && !draft.branch_slug)`. This is
 * that check, applied where it was missing.
 *
 * The rule is deliberately narrow: 'branch' without a branch is a refusal, not
 * a fallback to 'all'. An unrecognised audience is still 'all', exactly as
 * before — widening that would be a different decision than the one being made.
 */
export function resolveBroadcastAudience(targetAudience, branchSlug) {
  const audience = ['all', 'detailing', 'wash', 'branch'].includes(targetAudience) ? targetAudience : 'all'
  if (audience === 'branch') {
    const slug = String(branchSlug || '').trim()
    if (!slug) return { ok: false, error: 'Pick a branch before broadcasting to one branch.' }
    return { ok: true, audience, branchSlug: slug }
  }
  return { ok: true, audience, branchSlug: null }
}