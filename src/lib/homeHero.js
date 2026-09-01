export const HERO_MOBILE_MAX_WIDTH = 800

/**
 * When the Hakum mark is on screen in each cut, measured off the frames.
 *
 *   desktop-hero.mp4 (16.40s) — mark holds from the first frame and has faded
 *     by ~4.2s; the closing mark starts coming up at ~13.3s and stays to the end.
 *   mobile-hero.mp4  (13.07s) — no opening mark; the closing mark reads clearly
 *     from ~9.3s and stays to the end.
 *   bredesign-hero.mp4 (16.40s) — opening mark to ~0.8s, closing mark from ~15.0s.
 *
 * The overlay clears a beat after the mark is gone and goes a beat before it
 * returns, so the two never share the frame.
 */
const HERO_LOGO_WINDOWS = {
  desktop: { opensUntil: 5, closesFrom: 13.65 },
  mobile: { opensUntil: 0, closesFrom: 9.2 },
  /* bredesign-hero.mp4 (16.40s) — measured at 5fps off the encoded file: the
     opening mark holds from the first frame and has faded by 0.8s, the frame
     stays black until footage cuts in at 1.8s, and the closing mark starts
     coming up at 15.0s and stays to the end. Same beat either side. */
  bredesign: { opensUntil: 1.6, closesFrom: 14.6 },
}

export function getHeroVideoVariant(viewportWidth) {
  return viewportWidth <= HERO_MOBILE_MAX_WIDTH ? 'mobile' : 'desktop'
}

export function isHeroLogoMoment(variant, currentTime) {
  const window = HERO_LOGO_WINDOWS[variant] || HERO_LOGO_WINDOWS.desktop
  return currentTime < window.opensUntil || currentTime >= window.closesFrom
}

export function hasHeroLogoMomentRestarted(variant, previousTime, currentTime) {
  if (currentTime < previousTime) return true
  return !isHeroLogoMoment(variant, previousTime) && isHeroLogoMoment(variant, currentTime)
}
