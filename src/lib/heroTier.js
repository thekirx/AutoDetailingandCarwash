/**
 * Which cut of the hero clip a device should download.
 *
 * The hero is full-bleed, so the pixels it actually shows are the viewport
 * width times the device pixel ratio. Sending more than that is bytes and
 * decode work spent on detail the screen cannot draw — and the clip sits under
 * a scrim running from 0.58 to 0.96 alpha, so fine detail is dimmed on top of
 * that.
 *
 * Two things are guarded against rather than assumed:
 *   - Save-Data and 2g/3g links, where a 7.6 MB backdrop is indefensible.
 *   - Low core counts, which correlate with devices lacking a hardware AV1
 *     decoder. Software-decoding 4K there drops frames and burns battery.
 * Both fall back to a smaller cut, never to a broken one.
 */

export const HERO_TIERS = [720, 1080, 1440, 2160]

/* Two cuts, not two encodes of one cut. The desktop clip is 16:9 and the
   mobile clip is a 9:16 re-frame — cropping the wide one into a phone's tall
   viewport drops the polisher and the person out of frame entirely, which is
   the whole reason a separate portrait edit exists. Chosen on the shape of the
   viewport rather than its width, so a phone held sideways gets the wide cut. */
export function pickHeroOrientation({ width = 1440, height = 900 } = {}) {
  return height > width ? 'portrait' : 'landscape'
}

export function currentHeroOrientation() {
  if (typeof window === 'undefined') return 'landscape'
  return pickHeroOrientation({ width: window.innerWidth, height: window.innerHeight })
}

const TOP_TIER_MIN_CORES = 8

export function pickHeroTier({
  width = 1440,
  dpr = 1,
  saveData = false,
  effectiveType = '4g',
  cores = 8,
} = {}) {
  const devicePx = width * Math.min(dpr || 1, 3)

  let tier
  if (devicePx <= 1280) tier = 720
  else if (devicePx <= 1920) tier = 1080
  else if (devicePx <= 2560) tier = 1440
  else tier = 2160

  // A screen big enough for 4K does not guarantee a decoder that enjoys it.
  if (tier === 2160 && cores < TOP_TIER_MIN_CORES) tier = 1440

  // The connection caps the tier; it never raises it. Written as a ceiling
  // rather than a return value because a small phone on 3g should still get
  // the 720p cut its screen wanted, not the 1080p the cap allows.
  let ceiling = 2160
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') ceiling = 720
  else if (effectiveType === '3g') ceiling = 1080

  return Math.min(tier, ceiling)
}

/** Reads the environment for pickHeroTier. Safe to call during render. */
export function currentHeroTier() {
  if (typeof window === 'undefined') return 1080
  const conn = navigator.connection || {}
  return pickHeroTier({
    width: window.innerWidth,
    dpr: window.devicePixelRatio,
    saveData: Boolean(conn.saveData),
    effectiveType: conn.effectiveType || '4g',
    cores: navigator.hardwareConcurrency || 8,
  })
}

/* H.264 exists only as a fallback for browsers with no AV1 decoder, and only up
   to 1080p: the same picture at 1440p in H.264 is roughly 15 MB, which defeats
   the point of offering a higher tier at all. */
export function h264TierFor(tier) {
  return tier <= 720 ? 720 : 1080
}

/* The portrait cut ships at 720 and 1080 only: no phone draws more, and the
   H.264 fallback there is a single 1080 file. */
export function portraitTierFor(tier) {
  return tier <= 720 ? 720 : 1080
}
