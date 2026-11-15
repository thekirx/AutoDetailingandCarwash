# Full-System UAT & Cleanup Implementation Plan

> **For Claude:** Execute tasks cleanly in order, keeping edits surgical and verifying every change with tests, lint, build, and live E2E runs.

**Goal:** Eliminate the remaining live-DB, RBAC, UI-key, ESLint, and stale-E2E defects discovered during the full UAT baseline so all unit tests, lint checks, production builds, database audits, role UI QA checks, daily-operations E2E flows, and live domain checks pass cleanly before UAT sign-off.

**Architecture:**
- Keep Lovable-managed constraints untouched unless explicitly applying already-authored repo migrations via Supabase Management API (`lybxhpzzqqyqswvuwpxv`). Note `supabase/migrations/` files in repo are only touched if adding an index/optimization migration is needed, or verify existing indexes live.
- Fix RBAC/nav defects cleanly in `src/auth/permissions.js` and `src/pages/OperationsPages.jsx`, add regression unit tests, clean ESLint issues, update stale E2E scripts to match verified current product contracts, and re-run the complete verification matrix.

---

### Task 1: Apply Pending Live DB Migration `20261018120000_refer_a_friend.sql` & Verify FK Indexes

**Files / Systems:**
- Read-source: `supabase/migrations/20261018120000_refer_a_friend.sql`
- Live Supabase Project: `lybxhpzzqqyqswvuwpxv`

**Step 1: Execute migration SQL via UTF-8 Node `fetch` against Supabase Management API**
- Run `supabase/migrations/20261018120000_refer_a_friend.sql` wrapped cleanly in a transaction and record version `'20261018120000'` (`name = 'refer_a_friend'`) in `supabase_migrations.schema_migrations` (`ON CONFLICT (version) DO NOTHING`).
- Avoid PowerShell `Invoke-RestMethod` UTF-8 mangling by using Node `fetch`.

**Step 2: Verify live schema & audit FK indexes**
- Confirm `public.referral_program_settings` row `id=1`, `services.referral_eligible`, `public.customer_referrals`, and `public.customer_referral_rewards` exist and return HTTP 200 via REST/SQL.
- Check if `customer_referrals(qualifying_sale_id)` or `customer_referral_rewards(claimed_sale_id)` appear as unindexed foreign keys; if `npm run audit:db` reports them, add a small follow-up index migration and apply it live.

---

### Task 2: Fix Marketing/Investor Queue Board Gate & Duplicate `'hr'` Nav Key

**Files:**
- Inspect small ranges: `src/pages/OperationsPages.jsx` (lines 1-45, 1290-1315), `src/pages/PlanningBoardPage.jsx` (lines 120-150)
- Modify: `src/pages/OperationsPages.jsx`, `src/auth/permissions.js`
- Test: `tests/commandCategories.test.js`, `tests/marketingScope.test.js`

**Step 1: Inspect `OperationsPages.jsx` imports & `QueueTicketPage` guard**
- Confirm `canViewQueueBoard` is imported in `src/pages/OperationsPages.jsx` and check `QueueTicketPage` read-only behavior for `marketing` / `investor`.
- Update `OperationsQueueBoardPage` gate (`line 935`) from `!canViewQueueOperations && !salesView` to `!canViewQueueBoard(profile)`.

**Step 2: Coalesce duplicate group IDs in `groupOperationsNav()`**
- In `src/auth/permissions.js:828-844`, coalesce items matching any existing group `id` via `groups.find((g) => g.id === id)` instead of checking only the trailing group (`groups[groups.length - 1]`).
- Preserves exact `getOperationsNav()` order and eliminates duplicate `'HUMAN RESOURCE'` / `'hr'` React keys for Branch Admin (`admin`, `opslead`).

**Step 3: Add regression tests**
- Add assertions in `tests/commandCategories.test.js` (no duplicate group IDs for `ROLES.ADMIN` or any role) and `tests/marketingScope.test.js` / `tests/principalQaMatrix.test.js` verifying `canViewQueueBoard` allows `marketing` & `investor`.
- Run targeted Vitest tests (`npx vitest run tests/commandCategories.test.js tests/marketingScope.test.js tests/branchAdminShell.test.js`).

---

### Task 3: Resolve All ESLint Errors & Warnings

**Files:**
- Modify: `src/components/DemoAccountChips.jsx`, `src/pages/CustomerSignInPage.jsx`, `src/pages/LoginPage.jsx`, `src/pages/BranchInventoryPage.jsx`, `src/lib/demoSignIn.js`, `src/pages/PlanningBoardPage.jsx`, `scripts/e2e-main-domain-and-system-verify.mjs`

**Step 1: Inspect `PlanningBoardPage.jsx` lines 120-150 & fix hook dependency cleanly**
- Fix `useCallback` dependencies (`[searchParams, canEdit, profile]`) without infinite re-renders.

**Step 2: Remove unused imports, comment intentional empty `catch` blocks, add `/* global document */` in E2E script**
- Run `npm run lint` -> must exit `0` with zero errors.

---

### Task 4: Align Outdated E2E Scripts With Verified Specs

**Files:**
- Inspect remaining lines: `scripts/e2e-sales-bookings.mjs` (141-220)
- Modify: `scripts/e2e-daily-sheet-money.mjs`, `scripts/e2e-sales-bookings.mjs`, `scripts/e2e-plate-vehicle-queue.mjs`, `scripts/e2e-ui-money.mjs`

**Step 1: Fix script assertions & test isolation**
- `e2e-daily-sheet-money.mjs`: test unassigned branch `'imus'` (and/or Batangas-only `admin2@hakumautocare.com` on `'bacoor'`) for `/limited to your branch/` and verify wrong-branch CA code fails with `/approval code does not match/i`.
- `e2e-sales-bookings.mjs`: align `canCheckInFormBooking({ role: ROLES.SALES }) === false` check and any downstream assertion.
- `e2e-plate-vehicle-queue.mjs`: generate a unique test phone (instead of hardcoded `'09625294043'`), check `customers.upsert` `{ error }`, and wrap cleanup in `try/finally` so auth test users never leak.
- `e2e-ui-money.mjs`: expect BA `/operations/queue` to render read-only while `/operations/queue/new` redirects to `/operations/access-denied`, and assert live drawer heading `/Cash to collect/`.

---

### Task 5: Full Verification Suite & Live Local UI/E2E Wave

**Commands (in order):**
1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run check`
5. `npm run audit:api-auth`
6. `npm run audit:db`
7. Against local Vite server `http://127.0.0.1:5191`:
   - `node scripts/e2e-role-qa-wave.mjs` (target: 205/205, zero console errors)
   - `node scripts/e2e-ui-money.mjs`
   - `node scripts/e2e-ui-p0.mjs`
   - `node scripts/e2e-ui-forms.mjs`
   - `node scripts/e2e-daily-sheet-money.mjs`
   - `node scripts/e2e-sales-bookings.mjs`
   - `node scripts/e2e-plate-vehicle-queue.mjs`
   - `node scripts/responsive-validation.mjs`
8. Stop background Vite daemon (`task-3117`) cleanly after verification.

---

### Task 6: Update `PROJECT_STATUS.md`, Commit, Push & Live Production Smoke Test

- Update `PROJECT_STATUS.md` with observed 2026-11-15 fixes, migration parity, DB audit, and E2E counts.
- `git status` -> stage only intentional source/doc/migration/test changes (never `.env` or `e2e-evidence/`).
- `git commit` & `git push origin main`.
- Verify live `https://www.hakumautocare.com` with `node scripts/e2e-main-domain-and-system-verify.mjs`.
