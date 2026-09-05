export function serviceHeroProgress(scrollY, heroHeight) {
  if (!Number.isFinite(heroHeight) || heroHeight <= 0) return 0
  const progress = Number.isFinite(scrollY) ? scrollY / heroHeight : 0
  return Math.min(1, Math.max(0, progress))
}
