# Hakum — Readiness checklist (→ 100%)

Track until every box is checked. Update status when verified with fresh terminal or manual walkthrough evidence.

**Progress snapshot (2026-07-24):** **100% code + automated live readiness** (P0–P4) + **session management** (P5). Production ops gaps tracked in `SYSTEM_GAPS.md` (SMTP, secrets, browser E2E, observability).

---

## P5 — Session management (Supabase SPA standard)

- [x] `persistSession` + `autoRefreshToken` + PKCE (`src/lib/supabase.js`) — no custom `storageKey` (avoids wiping existing sessions)
- [x] Single-flight refresh (`src/lib/session.js`) so parallel `/api` callers don’t race refresh_token
- [x] `getAccessTokenFresh` → `ensureFreshAccessToken`
- [x] AuthProvider: skip profile reload on `TOKEN_REFRESHED`; visibility → `getSession`; `signOut({ scope: 'local' })`
- [x] TDD: `tests/session.test.js` + `scripts/check-session.mjs`
- [x] E2E: `session.fresh_token` assert in `e2e-readiness.mjs`

---

## P0 — Must ship (security + broken stubs)

- [x] Password reset = Supabase Auth email only (no SMS auth links)
- [x] `add-vehicle` cannot hijack another account’s plate (atomic claim)
- [x] Portal mutations require live `customers` row (`role=customer`, not archived)
- [x] `send_setup` / `send_reset` do not return `login_email`
- [x] Rate limit on `/api/customer-auth-lookup` auth-email actions
- [x] `/admin/queue` stub removed (redirect to live floor queue)
- [x] Customer wrong-role does not dump to ops access-denied
- [x] Security headers on Vercel (`vercel.json`)
- [x] Demo account chips gated to `import.meta.env.DEV`
- [x] `npm audit --omit=dev --audit-level=critical` — 0 critical (3 moderate in `shadcn` CLI toolchain only; not runtime app path)

## P1 — Functionality completeness

- [x] Label Services/Packages as marketing (**not** live `services` table)
- [x] Gate or strip `demoAccounts.js` chips outside development
- [x] Delete unused `CustomerLoginPage.jsx`
- [x] Remove dead branch-param UI in `PublicUtilityPage` QueuePage
- [x] Fix stale “future POS” copy on floor dashboard
- [x] Legacy `/admin/reports` → redirect to `/operations/reports`
- [x] Decide sunset of legacy `/admin/*` vs `/operations/*` — keep dashboard/calendar/customers; queue/reports redirect to operations (documented in `App.jsx`)

## P2 — Silent failure / RLS UX (common frontend bug)

- [x] Surface errors: Finance load, Pos `daily_sales_summary`, Crm loyalty/membership, Reports lines, Sms templates, BookingModal services
- [x] Handle `.error` on customer/ops login `maybeSingle` profile lookups
- [x] Standardize Bearer tokens via `getAccessTokenFresh()` (BookingBoard, Crm, Pos, Sms, queueApi, adminApi)
- [x] Stop swallowing Pos `notify-booking` failures
- [x] AuthProvider: do not silently null profile on transient RLS/network errors

## P3 — Optimization & design (impeccable / frontend-design)

- [x] Code-split largest chunks (`manualChunks` in `vite.config.js`: react / supabase / charts / three / calendar / maps / icons)
- [x] Account + ops settings: floor chrome theme tokens for light (`html:not(.dark) .floor-shell` …)
- [x] Public marketing: one composition hero — no dashboard clutter (already mostly ok)
- [x] Push + Install prompts: staggered (push ~1.6s, install ~5.2s) + `hakum-prompt-busy` so they don’t stack
- [x] Images: page hero uses `hakum-hero.webp`; PNG reserved for favicon / OG / PWA (intentional)

## P4 — Live readiness (automated)

Verified by `node scripts/e2e-readiness.mjs` (exit 0):

- [x] Customer: login + portal payload (branches / history / vehicles)
- [x] Public: branches + active services (book path data) + queue counts view
- [x] Auth lookup ready for demo customer
- [x] TL / Admin / BossMich / Staff / Marketing logins + role homes + RBAC guards (no sales/cashier)
- [x] Env: `SUPABASE_*`, VAPID present; BusyBee present
- [x] Confirm deploy secrets match local `.env` names before Vercel ship
- [x] Part 9: `node scripts/e2e-rbac-matrix.mjs` role × grant matrix + Part tables RLS smoke

## Confirmed OK (spot-check)

- [x] All 12 `/api/*` handlers exist and Vite-mounted
- [x] Customer portal GET/POST with Bearer
- [x] Ops queue / POS / CRM / bookings live Supabase
- [x] Page-level RBAC on sensitive ops pages
- [x] Transactional SMS only in `notifyBooking` (not auth)
- [x] `node scripts/check-audit-p2.mjs` invariants
- [x] `node scripts/check-audit-security.mjs` invariants
- [x] `node scripts/e2e-readiness.mjs` live smoke
- [x] `node scripts/e2e-rbac-matrix.mjs` Part 9 matrix

---

## Definition of 100%

All **P0–P4** checked. Automated live evidence: `e2e-readiness.mjs` + `e2e-rbac-matrix.mjs`. Optional browser click-through still recommended after each deploy.

**Gate commands (all must exit 0):**

```bash
node --test tests/session.test.js
node scripts/check-session.mjs
node scripts/check-audit-security.mjs
node scripts/check-audit-p2.mjs
node scripts/check-user-settings-auth.mjs
node scripts/e2e-readiness.mjs
node scripts/e2e-rbac-matrix.mjs
npm run build
```
