/**
 * Shared Web Push platform classification across desktop browsers, Android PWAs,
 * and Apple Safari Home Screen PWAs (APNs web.push.apple.com).
 */

export const PUSH_PLATFORMS = Object.freeze([
  {
    id: 'web',
    label: 'Web Browser',
    shortLabel: 'Web',
    hint: 'Desktop Chrome, Edge, Firefox, or macOS Safari',
  },
  {
    id: 'android',
    label: 'Mobile Android',
    shortLabel: 'Android',
    hint: 'Android Chrome / installed Android PWA (FCM)',
  },
  {
    id: 'ios',
    label: 'Mobile iOS',
    shortLabel: 'iOS',
    hint: 'iPhone/iPad Safari Add to Home Screen PWA (APNs)',
  },
])

/**
 * Classify a push_subscriptions row into 'ios' | 'android' | 'web'.
 */
export function classifyPushPlatform({ endpoint = '', user_agent = '' } = {}) {
  const ua = String(user_agent || '')
  let host = ''
  try {
    host = endpoint ? new URL(endpoint).hostname.toLowerCase() : ''
  } catch {
    host = ''
  }

  if (host.includes('push.apple.com') || /iPhone|iPad|iPod/i.test(ua)) {
    return 'ios'
  }
  if (/Android/i.test(ua)) {
    return 'android'
  }
  return 'web'
}

export function emptyPlatformCounts() {
  return { web: 0, android: 0, ios: 0 }
}

export function summarizeSubscriptionsByPlatform(rows = []) {
  const counts = emptyPlatformCounts()
  for (const row of rows || []) {
    const p = classifyPushPlatform(row)
    counts[p] = (counts[p] || 0) + 1
  }
  return {
    total: (rows || []).length,
    counts,
  }
}
