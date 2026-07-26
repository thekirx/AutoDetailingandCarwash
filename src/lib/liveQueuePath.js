/** Prefer branch slug when set; otherwise public branch picker. */
export function liveQueuePath(branchSlug) {
  const slug = String(branchSlug || '').trim()
  return slug ? `/queue/${encodeURIComponent(slug)}` : '/queue'
}
