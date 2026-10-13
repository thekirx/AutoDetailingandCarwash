/**
 * Demo account chips render on a device holding a QA key the server accepted
 * (opened once via `/operations/login?qa=<key>`), or always under `npm run dev`.
 * The key is the gate, checked server-side by /api/demo-login; this only decides
 * whether to show buttons. `import.meta.env.DEV` is a build-time constant, false in
 * every production bundle.
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

export function isDemoLoginEnabled({ qaKey = storedQaKey(), dev = Boolean(import.meta.env?.DEV) } = {}) {
  return Boolean(qaKey) || dev
}
