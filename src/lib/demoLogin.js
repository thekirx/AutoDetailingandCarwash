/**
 * Demo account chips render only on a device holding a QA key the server accepted
 * (opened once via `/operations/login?qa=<key>`), in production and in dev alike.
 * The key is the gate, checked server-side by /api/demo-login; this only decides
 * whether to show buttons.
 *
 * Never decide from the hostname: BUG-088 was `hostname.endsWith('vercel.app')`,
 * which put one-click Super Admin on the public site the moment it deployed.
 */
export const QA_KEY_STORAGE = 'hakum.demoQaKey'

export function storedQaKey() {
  try {
    return globalThis.localStorage?.getItem(QA_KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function isDemoLoginEnabled({ qaKey = storedQaKey() } = {}) {
  return Boolean(qaKey)
}
