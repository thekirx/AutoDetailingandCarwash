/** PWA install detection + copy. Shared by InstallGuide and push helpers. */

const DISMISS_KEY = 'hakum-pwa-install-dismissed-v1'
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent || '')
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean(window.navigator.standalone)
  )
}

/** @returns {'installed' | 'ios' | 'android' | 'desktop'} */
export function getInstallPlatform() {
  if (isStandaloneDisplay()) return 'installed'
  if (isIosDevice()) return 'ios'
  if (isAndroidDevice()) return 'android'
  return 'desktop'
}

export function wasInstallDismissed() {
  if (typeof localStorage === 'undefined') return false
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

export function dismissInstallGuide() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* private mode */
  }
}

export function clearInstallDismiss() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(DISMISS_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Ordered install steps for the current (or given) platform.
 * @param {'ios'|'android'|'desktop'|'installed'} [platform]
 */
export function getInstallSteps(platform = getInstallPlatform()) {
  if (platform === 'installed') {
    return {
      platform,
      title: 'Hakum is installed',
      lead: 'You already have the app on this device. Open it from your home screen for the best experience.',
      steps: [],
      tip: 'Enable alerts inside the app so you never miss a status update.',
    }
  }
  if (platform === 'ios') {
    return {
      platform,
      title: 'Add Hakum to Home Screen',
      lead: 'Use Safari — Home Screen unlocks the full app and visit push alerts.',
      steps: [
        'Open this page in Safari (not Chrome or in-app browsers).',
        'Tap Share (square with an arrow up).',
        'Tap Add to Home Screen, then Add.',
        'Open Hakum from the new icon, then tap Enable alerts.',
      ],
      tip: 'iOS 16.4+ needed for push alerts from the Home Screen app.',
    }
  }
  if (platform === 'android') {
    return {
      platform,
      title: 'Install Hakum on Android',
      lead: 'Add Hakum to your home screen for one-tap queue, stamps, and alerts.',
      steps: [
        'Open this page in Chrome.',
        'Tap Menu (⋮) → Install app or Add to Home screen.',
        'Confirm Install.',
        'Open Hakum from your home screen, then enable alerts.',
      ],
      tip: 'If Install Hakum appears below, use that for the fastest path.',
    }
  }
  return {
    platform: 'desktop',
    title: 'Install Hakum on this device',
    lead: 'Chrome or Edge can install Hakum as an app for faster access and alerts.',
    steps: [
      'Open this site in Chrome or Microsoft Edge.',
      'Click the install icon in the address bar, or Menu → Install Hakum Auto Care…',
      'Confirm Install.',
      'Open Hakum from your desktop or Start/Dock, then enable alerts.',
    ],
    tip: 'Desktop Safari and Firefox do not support one-click install — use Chrome or Edge.',
  }
}

export { DISMISS_KEY, DISMISS_MS }
