# Hakum Auto Care — Principal Architecture & Efficiency Review

**Date:** 2026-11-22 (Asia/Manila)  
**Scope:** Full-stack SPA/PWA frontend (`src/`), Vercel serverless gateways (`api/*.js`, `server/*.mjs`), Supabase Postgres + RLS (`supabase/migrations/*`), and live production routes (`https://www.hakumautocare.com`, `https://hakumauto.vercel.app`).

---

## 1. Current Topology & Critical Data Flows

| Layer | Boundary & Mechanism | Source of Truth / Contract |
|---|---|---|
| **Public & Customer PWA** | React 19 + Vite 6 + Tailwind v4 SPA with Workbox SW + `57` pre-rendered SEO HTML shells + bot SSR (`api/seo.js`). | `src/App.jsx`, `src/lib/publicSeoCatalog.js`, `src/pages/CustomerMorePage.jsx`. |
| **Staff Operations Shell** | Role-gated `.command-daylight` sidebar (Command roles) & `.floor-daylight` mobile dock/rail (Floor roles) behind `OpsRoleGate` + `ProtectedRoute`. | `src/auth/permissions.js`, `src/layouts/OperationsLayout.jsx`, `src/lib/opsNavigationRegistry.js`. |
| **Serverless API Gateways** | Consolidated to `10` Vercel serverless files under `api/*.js` (Hobby-tier budget `<= 12`), routing `41` audited handlers onto `server/*.mjs` via `?operation=`. | `api/*.js`, `vercel.json`, `scripts/audit-api-auth.mjs`, `server/staffAuth.mjs`. |
| **Database & Realtime** | Supabase Postgres (`lybxhpzzqqyqswvuwpxv`), PostgREST RLS, RPCs (`complete_pos_sale`, `submit_shift_close`, `review_shift_close`, `get_public_shop_catalog`, `save_own_staff_phone`), and Supabase Realtime channels. | `supabase/migrations/*`. |
| **Notifications & SMS** | BusyBee BrandTxt `HAKUM` (`app.brandtxt.io`) strictly for Detailing, Services & Packages booking/queue status SMS; Web Push (`web-push` + VAPID) + In-App Inbox (`user_notifications`) for all operational/customer events. | `src/lib/notificationConfig.js`, `server/notificationConfigApi.mjs`, `server/notifyBooking.mjs`, `server/webPush.mjs`. |

### Critical Read/Write Flows Audited
1. **Customer Status SMS & Notification Config:** `Bookings/Queue Status -> notifyBookingStatus -> loadNotificationConfig (notification_config <-> sms_notifications timestamp arbitration) -> isEligibleStatusSmsBooking + isStatusSmsAllowedByConfig -> busybeeSendSms + sms_events + user_notifications + sendWebPushToUsers`.
2. **POS -> Daily Sheet -> Finance Approval:** `PosPage -> complete_pos_sale RPC -> daily_sales_summary -> DailySheetPanel -> submit_shift_close / review_shift_close -> finance_daily_pl`.
3. **User Preferences & RBAC:** `OperationsLayout` / `CustomerMorePage` -> `UserSettingsModal` -> `supabase.auth.updateUser` / `save_own_staff_phone` / `customer-portal` / `user_settings`.

---

## 2. Confirmed Findings & Remediations Implemented (2026-11-22)

### F-01 `[correctness]` `[High]` — `UserSettingsModal` exposed broken Cash Advances card to Super Admin & dead SMS toggle to Staff
- **Evidence:** In live Puppeteer audit, `BossMich` navigated `/operations/my-advances` -> redirected to `/operations/access-denied` (`canAccessMyAdvances` returns `false` for Super Admin/Ops Lead). `UserSettingsModal.jsx` checked `!isCustomer && profile?.id` instead of `canAccessMyAdvances(profile)`, rendering a broken link and firing an unused ledger query, while rendering a customer-only SMS toggle inside the ops staff modal.
- **Fix:** Gated Cash Advance ledger load & card on `canAccessMyAdvances(profile)` and gated `SMS notifications` toggle on `isCustomer`; also fixed missing `vehicle_type: 'medium'` on modal vehicle reset and locked customer birthday editing after first save.

### F-02 `[correctness]` `[High]` — `CustomerMorePage` exposed failing `"Send test text"` CTA & unlabeled switch
- **Evidence:** Under strict Detailing/Services/Packages status-SMS policy, `POST /api/lifecycle-sms` (`self_test`) always returns `skipped` (`status_sms_only`), causing customer `"Send test text"` clicks in `/account/more?tab=alerts` to show error toasts. Meanwhile, the Push switch in `PushToggle.jsx` (`layout="panel"`) rendered `<button role="switch">` without an accessible label.
- **Fix:** Removed `sendTestSms`, updated copy to accurately describe automatic booking/queue status SMS, added accessible `aria-label="Push alerts"` on `PushToggle`, and added missing Inbox controls (`Mark all read`, `Show all (N)` toggle).

### F-03 `[maintainability]` `[Medium]` — Native blocking `window.prompt` / `window.confirm` / `alert` calls across Floor & CMS workflows
- **Evidence:** Static scan detected 6 native browser modal calls (`QueueTicketEditor.jsx:339/347/360/562`, `TeamLeadQueuePage.jsx:184`, `ContentBlockEditor.jsx:432`, `financeData.js:713`) breaking mobile PWA ergonomics and visual consistency.
- **Fix:** Introduced shared accessible `src/components/ops/ReasonConfirmDialog.jsx` replacing all `window.prompt`/`window.confirm` flows, and replaced blocking `alert()` in `financeData.js` `printAsPdf` with safe async `sonner` toast feedback.

### F-04 `[correctness / maintainability]` `[Medium]` — Inconsistent Settings Pages, Archived-Staff Leak & Missing CRUD Buttons
- **Evidence:**
  - `PosSettingsPage.jsx` bypassed `OpsPageShell`, and `PosSettingsPanel.jsx` lacked controls to add/remove payment methods or expense kinds or reset defaults.
  - `DailySheetRulesPage.jsx` queried active Team Leads without `.eq('is_archived', false)`, lacked defaults reset/refresh, and lacked per-row saving feedback.
  - `TintFinderSettingsPage.jsx` used `select('*')` on `tint_finder_leads`, lacked Settings breadcrumbs/back navigation, toast feedback, and lead status/search filters.
  - `SettingsHubPage.jsx` omitted direct tiles to owner Notification Policy (`?tab=settings`), Attendance Rules, and System Data Center.
  - `BookingBoardPage.jsx` returned an alert `<section>` without an `<h1>` when unassigned/sales branch setup was incomplete.
- **Fix:** Remediated every gap above while preserving all existing RBAC boundaries (`canWritePosSettings`, `canEditFinanceBooks`, `isSuperAdmin`).

### F-05 `[maintainability]` `[Low]` — Large Multi-Concern Page Files (Tracked Backlog)
- **Measured Inventory:** Top files by LOC: `src/pages/OperationsPages.jsx` (2,886), `src/pages/PosPage.jsx` (2,396), `src/pages/BookingBoardPage.jsx` (2,132), `src/pages/NotificationsPage.jsx` (1,882). Remaining `.select('*')` occurrences (`27`) are predominantly single-row (`id = 1`) settings tables (`ops_pos_settings`, `compensation_settings`, `referral_program_settings`).
- **Recommendation (Deferred / Non-Blocking):** Split `OperationsPages.jsx` into per-route page modules (`OperationsDashboardPage`, `OperationsQueuePage`, `QueueTicketPage`, `NewQueueTicketPage`, `MyTasksPage`) during the next scheduled cleanup window so code-splitting isolates each floor chunk. Not executed opportunistically here because `OperationsPages.jsx` already passes bundle/runtime verification cleanly.

---

## 3. Risks, Migration Order & Rollback

- **Schema Risk:** Zero SQL DDL migrations required for these fixes — all server/client fixes operate on existing tables and RLS policies.
- **Rollback Plan:** Pure frontend/UI module edits in commit group; single `git revert <commit>` restores prior UI without schema or data side effects.
- **Acceptance Metrics Verified:**
  - `npm run lint` = `0` warnings/errors
  - `npm run audit:api-auth` = `41` handlers scanned, `0` unauthenticated/unscoped gaps
  - `npm test` = `100%` passing unit suite
  - `npm run check` & `npm run build` = clean exit `0`
  - Live Puppeteer sweep (`hakumauto.vercel.app` & `www.hakumautocare.com`) = `0` console errors, `0` page errors, `0` HTTP 5xx, `0px` horizontal overflow (`1440px` + `375px`).
