/**
 * Demo account chips: local `vite dev`, or a deployment that explicitly opts in.
 *
 * HISTORY, because the shape of this file is a scar. BUG-088 (Critical) was a
 * host check: `isDemoLoginEnabled()` returned true on any `*.vercel.app` host,
 * which meant the live site showed one-click Super Admin to anyone who opened
 * the URL, and production served all 15 staff passwords as a public JS chunk.
 * The repo is public. A host rule cannot be reasoned about — it enables itself
 * the moment you deploy somewhere.
 *
 * So the opt-in is an explicit value that only exists in a build environment:
 *
 *   dev    — `import.meta.env.DEV`, i.e. `npm run dev` on your machine.
 *   deploy — `VITE_ENABLE_DEMO_LOGIN=true`, set in the Vercel project's env vars
 *            (or a local `.env`, which is gitignored). Never committed: putting it
 *            in a tracked `.env.production` is what BUG-088 actually was.
 *
 * Both are build-time literals, so Vite folds the condition and still drops the
 * `demoAccounts` chunk from a production build where the flag is absent. That is
 * why the pages re-check a *literal* `import.meta.env.DEV || ...` inline rather
 * than calling this function behind the dynamic import.
 *
 * Turning the flag on must NOT publish the passwords. It no longer does:
 * `demoPassword()` reads only `process.env`, and the chips call `/api/demo-login`,
 * which signs in server-side and returns a session. Setting this flag exposes
 * buttons, not credentials.
 *
 * The owner has accepted re-enabling the chips on the deployed site for testing
 * (2026-10-12). That is recorded as an accepted risk on BUG-088, not silently
 * reintroduced.
 */
export function isDemoLoginEnabled({
  dev = import.meta.env?.DEV,
  flag = import.meta.env?.VITE_ENABLE_DEMO_LOGIN,
} = {}) {
  return Boolean(dev) || flag === 'true'
}