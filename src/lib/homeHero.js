export const HERO_MOBILE_MAX_WIDTH = 800

export function getHeroVideoVariant(viewportWidth) {
  return viewportWidth <= HERO_MOBILE_MAX_WIDTH ? 'mobile' : 'desktop'
}

export function isHeroLogoMoment(variant, currentTime) {
  if (variant === 'mobile') return currentTime >= 9.8
  return currentTime < 5 || currentTime >= 13.65
}

export function hasHeroLogoMomentRestarted(variant, previousTime, currentTime) {
  if (currentTime < previousTime) return true
  return !isHeroLogoMoment(variant, previousTime) && isHeroLogoMoment(variant, currentTime)
}
