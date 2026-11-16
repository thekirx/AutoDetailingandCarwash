# Hakum Auto Care — Engineering & Operations Handoff Guide

**Date:** 2026-11-16 (Asia/Manila)  
**Repository:** `https://github.com/thekirx/AutoDetailingandCarwash.git` (Branch: `main`)  
**Production Domain:** `https://www.hakumautocare.com` (Vercel + Supabase `lybxhpzzqqyqswvuwpxv`)  
**Current Verified Head (code + tests before this doc commit):** `8eb0990`  

This document is the primary onboarding brief for the next AI engineer or technical lead picking up Hakum Auto Care. Read this together with the persistent Graphify knowledge graph before modifying code.

---

## 1. Recommended Reading Order (Before Writing Code)

1. **`AGENTS.md` / `CLAUDE.md`** — Project rules, Archify/Graphify rules, and outbound SMS policy (`BusyBee` outbound customer reminders only; no owner daily SMS).
2. **`CONTEXT.md`** — Canonical domain glossary (Queue vs Bookings, Car sizes, POS → Daily Sheet → Finance Approval money path, RBAC roles, Planner, Inventory).
3. **`HANDOFF.md`** *(this file)* — Current architecture, recent changes (`ba3ae8a` → `8eb0990`), verification state, and open operational blockers.
4. **`docs/GRAPHIFY.md`** & **`graphify-out/`** — Persistent AST + semantic knowledge graph. Query it first before broad grep sweeps:
   ```powershell
   $env:PATH = "C:\Users\jcuad\.local\bin;$env:PATH"
   graphify query "How does Team Planner Forms save and publish work?"
   graphify path "complete_pos_sale" "review_shift_close"
   graphify explain "LOCAL_BRANCH_PAGES"
   graphify update .
   ```
   Deep reference docs under `docs/`: `GRAPHIFY_MEMORY.md`, `GRAPHIFY_WORKFLOWS.md`, `GRAPHIFY_DB_DETAIL.md`, `GRAPHIFY_DB_FULL.md`, `GRAPHIFY_RLS.md`, `GRAPHIFY_MONEY_PAYLOADS.md`, `GRAPHIFY_FRONTEND.md`, `GRAPHIFY_SEAMS.md`, `GRAPHIFY_GAPS.md`.
5. **`PROJECT_STATUS.md`** & **`CHANGELOG.md`** — Chronological operational log and release notes.

---

## 2. System Topology & Non-Negotiable Seams

| Layer | Technology & Entrypoints | Key Rules |
|---|---|---|
| **Frontend SPA / PWA** | React 19 + Vite 6 + Tailwind v4 (`src/App.jsx`, `vite.config.js`) | PWA via `vite-plugin-pwa` (`public/manifest.webmanifest`, `public/push-sw.js`) + `PwaUpdateBanner.jsx` (`/version.json` drift detection + safe auto-reload). |
| **Static SEO Prerender** | `scripts/prerender-seo.mjs` (runs automatically in `npm run build`) | Writes 23 static HTML shells under `dist/` (`services`, local city hubs `/near-me/*`, `/branches/*`, `/blog/*`, etc.) with canonical tags, OpenGraph, and Schema.org JSON-LD. |
| **API Gateway (`/api/*`)** | Thin Vercel serverless handlers in `api/*.js` delegating to `server/*.mjs` (mirrored locally in Vite dev) | **Strict contract**: Every `/api/*` call in the client must map to a handler/rewrite (`tests/apiRouteContract.test.js`), and every handler must authenticate or be explicitly exempted (`npm run audit:api-auth` scans 36 handlers). |
| **Database & Auth** | Supabase Postgres (`supabase/migrations/*`), PostgREST, Realtime (`supabase_realtime`), Auth (`PKCE` + `localStorage`) | Never touch historical migrations or fabricate RLS bypasses. Money calculations live in shared pure helpers (`src/lib/sheetFormulas.js`, `src/lib/dailySheet.js`, `src/lib/posSale.js`) aligned with SQL RPCs (`complete_pos_sale`, `submit_shift_close`, `review_shift_close`). |
| **Domain Split** | Queue (`src/queue/`, `/operations/queue`) vs Bookings (`src/pages/BookingBoardPage.jsx`, `/operations/bookings`) | **Queue** = same-day wash / add-ons / wash packages. **Bookings** = multi-day detailing (`ceramic`, `tint`, `ppf`, `paint_maintenance`) enforced by `catalog_line_kind` and SQL triggers (`20261115223000`). |
| **Branches** | `bacoor` & `batangas` = Active & Public; `dasmarinas` & `imus` = `coming_soon = true, is_active = false, is_public = true` | Operational branch dropdowns filter via `filterFormBranchSlugs` (so public/staff ops forms only show active branches), while SEO/local discovery highlights Bacoor, Cavite/Dasmariñas, Imus, and Batangas. |

---

## 3. Progress as of 2026-11-16 (`ba3ae8a` → `8eb0990`)

### A. Real Catalog, Coffee Menu, Sellables & 15 Real Staff Cutover (`a73083e` .. `ba3ae8a`)
- Replaced placeholder services/products with **33 active services** (**12 detailing** + **21 car wash / packages / treatments** with Small/Medium/Large/XL tiers; Motorcycle SKUs exclude L/XL as N/A), **6 Coffee Menu items**, **5 Sellables**, and **Points Shop** redemptions seeded with `product_branch_stock` on `bacoor` and `batangas`.
- Synced **15 real named staff accounts** via `scripts/sync-real-staff.mjs` (Team Leads, Branch Admins `Jennica`/`Peter`/`Almirra`, General Admins `Lucy`/`Robert`/`Bryan`, Marketing Manager `Mira`) while keeping demo/QA accounts behind dev-only / `?qa=` key gating.
- Fixed branch-scoping, Referral FK indexes (`0` unindexed FKs), and `sales` read access on `bookings`.

### B. Services / Packages Hardening & Editorial Blog Redesign (`af44550`, `7e5eedf`)
- **Backend Hardening (`20261115223000_services_packages_detailing_backend_hardening.sql`)**: Enforced `package_components` integrity (no self-parent/deep-nesting/missing-included rows) and strict `catalog_line_kind` separation (`server/customerPortal.mjs`, `server/publicBook.mjs`, `src/lib/serviceKinds.js`, `src/lib/uiDeadControls.js`, `CustomerBookPage.jsx`, `PublicUtilityPage.jsx`).
- **Blog Editorial System & WCAG AAA Contrast (`BlogArticlePreview.jsx`, `BlogPage.jsx`, `BlogPostPage.jsx`, `CustomerBlogPage.jsx`, `bredesign.css`)**: Obsidian-navy palette (`#020A31` / `#08133F` / `#F1F1ED` / `#9DB4FF` / `#052699`), high-contrast CTAs/eyebrows/related cards, search + featured guide card, dark/light Customer portal block support, and realtime `postgres_changes` sync.
- **Full Blog/Event CRUD & Full-Screen Real-Time Preview (`ContentStudioModal.jsx`, `ContentAdminPage.jsx`, `server/provisionStaff.mjs`, `src/lib/contentCmsApi.js`)**: Fixed `initialValue` prop mismatches on `BlogPostPage.jsx` & `EventSharePage.jsx`, replaced unsafe slug `upsert` with explicit conflict checks (`409`) and `update().eq('id', ...)`, and shipped edge-to-edge Full-Screen (`100dvh`) Split/Preview with Desktop/Tablet/Mobile toggles.
- **DB Optimization (`20261115233000_blogs_events_realtime_grants_and_optimization.sql`)**: Enabled `supabase_realtime` on `blogs` & `events`, locked `anon` grants to `SELECT` only, indexed `updated_at`, and added `sync_cms_content_row()` triggers/constraints.
- **Signed-In Header Identity (`7e5eedf`, `PublicLayout.jsx`)**: Fixed signed-in public header so authenticated customers/staff see their signed-in name instead of `Sign In` / `Sign Up`, and aligned card CMS Edit/Unpublish/Delete buttons.

### C. Permanent Form Results Board (`2a709c8`)
- Added **`/operations/forms/results`** and **`/operations/forms/results/:slug`** (`FormResultsBoardPage.jsx`, `src/lib/formResults.js`, `src/lib/formResultsApi.js`, `src/styles/formResultsBoard.css`) + server handlers in `server/provisionStaff.mjs`.
- Board-style UI aligned with Hakum design tokens featuring **sub-tabs by form kind** (`All forms`, `Events RSVP`, `Feedback`, `Equipment repairs`, `Cash advance`, `Detailing services`, `Custom forms`), full search, status/branch filters, date presets + custom date range filtering, click-card full submission inspection modal, and **Owner (`BossMich`)-only** result edit/delete enforcement.

### D. Local Near-Me SEO, AI Visibility, PWA Auto-Updates & Realtime Notifications (`3c20c2b`)
- **Brand Positioning & Local Discovery (`src/lib/localBranchPages.js`, `src/lib/pageMeta.js`, `src/lib/seoLocalGuides.js`, `src/components/PublicPageMeta.jsx`)**: Positioned Hakum Auto Care as one of the fastest-growing and most trusted automotive detailing, paint protection (PPF & ceramic coating), and car wash studios in the Philippines.
- **Near-Me & City Landing Hubs (`src/pages/BranchCityPage.jsx`, `src/components/public/NearestBranchFinder.jsx`, `src/pages/PublicPages.jsx`)**: Built local landing routes (`/near-me/*`, Bacoor, Imus, Cavite, Batangas City) + geolocation/quick-city finder (`QUICK_CITY_ORIGINS`) + `BranchCityPage` FAQ/LocalBusiness JSON-LD + enhanced Blog Schema.org (`Article`/`BlogPosting`) + `scripts/prerender-seo.mjs` (23 static HTML shells) + updated `public/sitemap.xml` and `public/robots.txt`.
- **Cross-Platform PWA Persistence & Update UX (`src/lib/pwaUpdates.js`, `src/components/PwaUpdateBanner.jsx`, `src/main.jsx`, `vite.config.js`, `public/manifest.webmanifest`)**: Requests persistent storage (`navigator.storage.persist()`), polls `/version.json` every `4 min` + SW registration checks, pauses auto-reload safely when user is actively typing/editing (`isUserBusyEditing`), surfaces an explicit `Refresh` banner (`PwaUpdateBanner`), and performs a safe auto hard-reload countdown across Windows, Chrome/Edge, Android, and iOS Home Screen PWAs.
- **In-App & Push Notifications (`src/lib/inAppNotifications.js`, `src/components/InAppNotificationListener.jsx`, `public/push-sw.js`)**: Global realtime `user_notifications` toast + chime + OS app badge sync (`syncAppBadge`), paired with Web Push (`public/push-sw.js`) for background notifications across staff and customer sessions.

### E. Team Planner Configure UX (`6af72a1`)
- Rebuilt **`PlanningConfigurePanel.jsx`** (`src/lib/planCategoryRoles.js`, `src/lib/plannerBoard.js`, `src/styles/plannerConfigure.css`) so settings clearly display live saved state vs pending edits, board role visibility checklists (`BossMich`, `ASA`, `Operations Lead`, `Branch Admin`, `Team Lead`, `Marketing`, `Video editor`, `Sales`, `Detailer`, `Crew`), category swatch/role scoping, template management, and column ordering in one intuitive screen.

### F. Fixed Planner Forms + Input Sequence Reordering + Events RSVP Removal (`8eb0990`)
- **Removed Events RSVP forms from Planner**: Excluded `kind === 'event'` from `PlanningFormsSmartPanel.jsx` queries/pickers and removed `"Create event form"` / `onCreateForm` wiring from `PlanningPart6Panels.jsx` (`PlanningEventsPanel`) and `PlanningBoardPage.jsx`. *(Historic `'event'` tabs/constants remain in `opsForms.js` and `formResults.js` so existing Form Results Board history continues to work cleanly.)*
- **Fixed Non-Editable Forms (`PlanningFormsSmartPanel.jsx`, `moveFormField` in `src/lib/opsForms.js`)**: Replaced the editable form builder (`FieldBuilder`, `Add field`, `Edit` modal, `Start from a template`, `New detailing form`, `New custom form`, `Archive`) with:
  - Locked form name, slug, description, input labels, types, and required flags.
  - **`FixedSequenceList`**: Up/Down buttons + HTML5 drag-and-drop sequence reordering (respecting step boundaries on wizard forms).
  - **Side-by-side Real-Time Preview**: Inline `<BrandedOpsForm preview />` updating live on every sequence reorder or public-link toggle, plus enlarged `Preview` modal.
  - **Save & Publish controls**: `Reset order`, `Save order`, `Save & Publish`, and `Unpublish`.

---

## 4. Verification Baseline (Current as of `8eb0990`)

The following ran against `8eb0990` directly and passed with exit code `0`:
- `npm run lint` (`eslint .`) → **0 errors / 0 warnings**
- `npm test` → **2,645 / 2,645 tests passed across 595 suites** (`0` failed, `0` skipped)
- `npm run check` (`check:planning`, `check:portal`, `check:settings-auth`, `check:customer`, `check:live-queue`) → **ok**
- `npm run audit:api-auth` → **36 handlers scanned, 0 unauthenticated leaks, 0 unscoped leaks**
- `npm run build` → **Vite production bundle + PWA SW precache + 23 static prerendered SEO HTML files built cleanly**
- **Puppeteer UI check (`vite preview` + mocked `BossMich` session)** on `/operations/planning?tab=forms` & `?tab=events` → confirmed `Events RSVP` absent, builder buttons absent, `"Move Service down"` updates `"Real-time preview"` DOM order immediately, `"Save & Publish"` dispatches `PATCH` with reordered `fields` & `status: 'published'`, mobile (`390×844`) overflow `false`, and `pageErrors: []`.

> **Stale / Prior-Stamp Checks Notice:** Live Supabase DB E2E scripts (`e2e-role-qa-wave.mjs`, `e2e-ui-money.mjs`, `e2e-daily-sheet-money.mjs`) and live production domain Playwright/Puppeteer verification (`https://www.hakumautocare.com`) last ran cleanly on `ba3ae8a` / `cb96fdc` (2026-11-15). Re-run live production verification after deploying `8eb0990` (`2a709c8`..`8eb0990`) to confirm Vercel SSR/static prerendered routes, `/operations/forms/results`, PWA update banner, and Planner Forms/Configure in production.

---

## 5. Open Items & Operational Blockers (Do Not Auto-Mark Done)

1. **Vercel Deployment & Env Parity**: Ensure `8eb0990+` deploys cleanly on Vercel production (`www.hakumautocare.com`) and verify all `.env.example` keys (especially `VITE_VAPID_PUBLIC_KEY` / `VAPID_*`, `SUPABASE_SERVICE_ROLE_KEY`, `BUSYBEE_*`, `RESEND_*`) match Vercel Production environment variables.
2. **BrandTxt / BusyBee SMS Egress Whitelisting (`BUG-002`)**: Production SMS calls require the outgoing IP (Vercel Static IPs / office egress) to be whitelisted by BrandTxt (`app.brandtxt.io`); previous checks hit `ErrorCode -1` / `11`.
3. **Floor / Staff Web Push Opt-In (`BUG-062`)**: Code, `public/push-sw.js`, and `InAppNotificationListener.jsx` are wired, but live staff devices must still click **"Enable alerts"** in the portal/browser (previously `0 / 34` active subscriptions in live DB audit).
4. **Supabase Dashboard Ops**:
   - Configure custom SMTP / verify Auth password-reset & signup emails arrive in inbox (`Gate 10.1`).
   - Enable **HaveIBeenPwned Leaked Password Protection** in Supabase Auth settings.
   - Optional: Have owner confirm and run the **BUG-061** void SQL if cleaning the 2 pre-existing 2026-09-29 test handoffs (`₱5,397.50`).
5. **Working Tree Hygiene**: Avoid committing `tmp-*.txt` / `tmp-*.json` / scratch scripts at the repo root (notice pre-existing untracked `tmp-*` artifacts in working directory — check `git status -s` carefully and stage files explicitly by path).

---

## 6. Guardrails & Gotchas for the Next AI Agent

- **Do NOT add new test/dev dependencies casually** or copy arbitrary hex colors into JSX — `tests/designTokenConsistency.test.js` fails on unallowed raw hex values (`KNOWN_TOKEN_DUPLICATES` tracks legacy exceptions line-by-line!).
- **Do NOT add an `/api/*` endpoint without updating `vercel.json` / `server/*.mjs` AND satisfying `npm run audit:api-auth`** (`apiRouteContract.test.js` enforces gateway parity).
- **Do NOT alter historical `supabase/migrations/*.sql`** or fake `audit:db` pass states.
- **Do NOT treat Owner Daily SMS as missing**: per product policy, owner SMS is intentionally disabled; Daily Sheet review uses in-app + web push notifications.
- **Windows Shell (PowerShell)**: Use `;` with `if ($LASTEXITCODE -eq 0)` instead of `&&` in terminal commands, and always run `npm run lint && npm test && npm run check && npm run audit:api-auth && npm run build` before declaring any milestone done.
- **Keep `/graphify` fresh**: After significant edits or pulls, run `graphify update .` so `graphify-out/` stays aligned with `HEAD`.
