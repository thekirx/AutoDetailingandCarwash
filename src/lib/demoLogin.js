/** Demo account chips: local DEV, explicit flag, or Vercel preview/demo host. */

export function isDemoLoginEnabled({
  dev = import.meta.env.DEV,
  flag = import.meta.env.VITE_ENABLE_DEMO_LOGIN,
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
} = {}) {
  if (dev) return true
  if (String(flag || '').toLowerCase() === 'true') return true
  // Preview / project.vercel.app demos — one-click floor roles for QA
  if (hostname && /\.vercel\.app$/i.test(hostname)) return true
  return false
}
