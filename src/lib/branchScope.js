/**
 * Fail-closed branch slug helpers for money paths (no silent site defaults).
 * Pure — safe for node:test without loading Supabase.
 */

/**
 * Resolve a real branch slug. Order: preferred → profile.branch_slugs[0] → profile.branch_slug → null.
 */
export function requireBranchSlug(profile, preferred = '') {
  const pick = String(preferred || '').trim()
  if (pick) return pick
  const multi = Array.isArray(profile?.branch_slugs)
    ? profile.branch_slugs.map((s) => String(s || '').trim()).filter(Boolean)
    : []
  if (multi.length) return multi[0]
  const home = String(profile?.branch_slug || '').trim()
  return home || null
}
