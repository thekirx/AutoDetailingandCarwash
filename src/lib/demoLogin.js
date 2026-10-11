/**
 * Demo account chips: local `vite dev` only. Production runs on *.vercel.app, so a
 * host or build-flag rule put one-click Super Admin sign-in on the public site.
 */
export function isDemoLoginEnabled({ dev = import.meta.env.DEV } = {}) {
  return Boolean(dev)
}
