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
 * DEFAULT IS NOW ON (owner decision 2026-10-13, second one). The chips render on
 * every deployment, including production, unless VITE_ENABLE_DEMO_LOGIN is set to
 * exactly the string "false". So the opt-out is one env var, and the exposure is
 * one-click Super Admin for anyone who visits the site.
 *
 * That was a deliberate reversal of the previous fail-closed default, which
 * required `=== 'true'`. The owner asked twice for the chips to be visible in
 * production and cannot set Vercel env vars from the repo. Recorded as an
 * accepted risk on BUG-088. The one thing that must survive the reversal is that
 * no password ever reaches the browser: `demoPassword()` reads only
 * `process.env`, and the chips call `/api/demo-login`, which signs in server-side.
 * Turning the flag on exposes buttons, not credentials.
 *
 * There is deliberately still no hostname in this function. BUG-088's original
 * shape was `hostname.endsWith('vercel.app')`, which enabled itself on deploy.
 * The on/off decision is a value someone sets, never a property of the address
 * bar.
 */
export function isDemoLoginEnabled({
  dev = import.meta.env?.DEV,
  flag = import.meta.env?.VITE_ENABLE_DEMO_LOGIN,
} = {}) {
  return Boolean(dev) || flag !== 'false'
}