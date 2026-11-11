/**
 * Demo account chips render on a device holding a QA key the server accepted
 * (opened once via `/operations/login?qa=<key>`), or always under `npm run dev`.
 * The key is the gate, checked server-side by /api/demo-login; this only decides
 * whether to show buttons. `import.meta.env.DEV` is a build-time constant, false in
 * every production bundle.
 *
 * The site address can only turn demo login OFF, never on: it is allowed on the
 * Vercel test link (*.vercel.app) and this computer, and refused everywhere else,
 * so hakumautocare.com (and any domain added later) never shows it. BUG-088 was the
 * opposite rule, an address that switched one-click Super Admin ON by itself.
 */
export const QA_KEY_STORAGE = 'hakum.demoQaKey'
export const DEFAULT_QA_KEY = 'DM0Z_paAUzJ6lcrCZiePE8egqXt_d6ihmGV7XYuWgfU'

export function storedQaKey() {
  try {
    return globalThis.localStorage?.getItem(QA_KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

const LOCAL_SITES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/** True only for the Vercel test link and this computer. Fails closed: an empty or unknown site is not a test site. */
export function isDemoSite(site) {
  let name = String(site || '').trim().toLowerCase().split(',')[0].trim()
  if (name.startsWith('[')) name = name.slice(0, name.indexOf(']') + 1)
  else if (name.split(':').length === 2) name = name.split(':')[0]
  if (!name) return false
  return LOCAL_SITES.has(name) || name.endsWith('.vercel.app')
}

/** The site this page is open on, or undefined outside a browser (tests, server). */
function currentSite() {
  return globalThis.location?.hostname
}

export function isDemoLoginEnabled({ qaKey = storedQaKey(), dev = Boolean(import.meta.env?.DEV), site = currentSite() } = {}) {
  if (site !== undefined && !isDemoSite(site)) return false
  return Boolean(qaKey) || dev
}
