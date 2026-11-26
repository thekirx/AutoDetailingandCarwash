# System Audit

## Latest Refresh (2026-11-26 — Full-System Deep Audit: Live SQL Money, Backend APIs, POS/Finance, Ops/Planning & Customer/Chatbot Hardening)

| Check | Result |
|-------|--------|
| Live Supabase schema, advisor & query cross-validation (`lybxhpzzqqyqswvuwpxv`) | **COMPLETE** — Verified `0` `rls_disabled` tables, `0` `unindexed_fk` constraints, `0` `secdef_no_search_path` functions, `0` `rls_initplan` policies, `0` missing RPCs/tables; caught and fixed `sales.payment_parts` nonexistent-column select in `server/financeOwnerOps.mjs` (`saleMoneySelect()`). |
| Applied live SQL money & referral migration (`20261126223000_audit_money_referral_fixes.sql`) | **APPLIED & REPAIRED** — Fixed `review_daily_sheet` salary `paid_from` + GCash backfill, `daily_sheet_server_totals` `filter (where status = 'paid')`, `daily_sales_summary` card/debit/bank tender buckets, `send_payslip` Manila payroll cutoff timestamps & `update_office_payslip` ASA parity, `cash_advance_ledger` ASA `'all'` branch scope, `booking_payable_minor` discounted `final_price_minor`, and `bookings_friend_referral_before` normalized code lookup (`NAME-XXX` + `HKXXXXXX`). |
| Backend API & transaction fixes | **PASS** — Fixed `customerAuthLookup.mjs` email reset when Auth holds synthetic `@customers.hakumautocare.com` email but `customers.email` holds a real address, `customerSignup.mjs` `email_confirm: true` on `claimTeamLeadAccount`, `publicBook.mjs` `400` date guard, `customerPortal.mjs` `apply-booking-voucher` (`for_payment`/`₱0` guard + referral code dedupe), atomic upserts + error handling in `notificationSettingsApi.mjs`/`notificationConfigApi.mjs`/`pushApi.mjs`, and `api/customer.js` CORS `req`. |
| Money, POS & Finance frontend fixes | **PASS** — Scoped `PosPage.jsx` voucher application to target `booking_id`, awaited post-sale voucher/referral/birthday RPCs, prevented Branch Admin ad-hoc/referral discount mismatch, added `debit`/card variants in `effectiveCeramicToggles`, fixed `updateTicketVehicleType` per-line pricing on multi-service visits, `QueueTicketEditor` `₱0` price input, `DailySheetRulesPage` `?tab=sheets` link, `MonthlyPayrollPage` Manila calendar defaults, `MyCashAdvancesPage` ASA scope, and 44px `.pl-cell-btn`/`.pl-clickable-category` touch targets. |
| Ops, Planning, CRM & Settings hardening | **PASS** — Aligned `/operations/settings/pos` & `/operations/settings/daily-sheet` gates, added `operations_lead` to `canViewRedoLane`, guarded `BookingBoardPage` `returnToQueue` & `openCreate` clicks, fixed `TaskModal` missing staff roles (`detailer`/`sales`/`operations_lead`), ordered `PlanningFormsSmartPanel` form save before `plan_cards` creation, surfaced explicit errors on `InquiriesPage`/`FormResultsBoardPage`/`KpiPage`, fixed `HistoryPage` ASA branch scope, `CrmPage` POS-only customer inclusion + removed stray Finance card, and guarded `TintFinderSettingsPage` optional fields. |
| Customer Portal, Public Flows & Chatbot sync | **PASS** — Removed 24-stamp cap in `StampTrack.jsx` (supports 30-slot cards), removed anonymous `service_size_prices` embed causing HTTP 400 in `hakumChatbotLiveCatalog.js`, updated `hakumChatbotEngine.js` tint sizes (`sedan`/`van`), ceramic tiers, queue stages & 30-slot copy, fixed flex/grid overflow in `HakumChatbot.css`/`customer-native.css`/`bredesign.css`, enabled guest `/api/referral-staff` fetch, unified `normalizeReferralCode` for both formats, hardened phone/`?voucher=`/`for_payment`/error states across `PublicUtilityPage`/`CustomerBookPage`/`CustomerVisitPage`/`CustomerSignUpPage`/`PublicFormPage`/`CustomerAccountPage`/`PublicShopPage`. |
| Automated checks (`audit:api-auth`, `check`, `lint`, `npm test`, `npm run build`) | **PASS** — `43/43` `/api/*` auth handlers, `5/5` `check:*` scripts, `0` ESLint errors/warnings, **2,825 / 2,825** unit tests across **628** suites (`0` failed, `0` skipped), production Vite + PWA (`526` entries) + SEO prerender (`60` shells). |
| E2E Daily Sheet, Role QA & Browser suite (`e2e:daily-sheet-money`, `e2e:role-qa`, `test:browser`) | **PASS** — `38 / 38` checks on `e2e:daily-sheet-money`, `52 / 52` across all 13 roles on `e2e:role-qa`, and **41 / 41** Playwright browser tests across **6** suites (`0` failed, `0` skipped). |
| Knowledge graph (`graphify-out/`) | **Updated** — `graphify update .` synced after final edits. |

## Prior Snapshot (2026-11-25 — Deep System Frontend Audit, Design-System & UX Hardening across All 13 Roles)

| Check | Result |
|-------|--------|
| Deep system audit checklist | **COMPLETE** — Verified across all 11 staff roles + Guest + Customer (`/operations/*`, `/account/*`, `/signin`, `/signup`, `/account/set-password`, `/book`, `/queue`, `/shop`, `/complaints`, `/f/:slug`, `/403`, `/404`). |
| Boundaries & 403/404 recovery | **PASS** — Added `OpsErrorBoundary` around both `FloorAppShell` and `CommandShell` `<Outlet />`, in-shell `OpsNotFoundPage` (`/operations/*`), `CustomerNotFoundPage` (`/account/*`), `/account/pickup` redirect, and role-aware `ForbiddenPage`. |
| Design-system & confirm standardization | **PASS** — Replaced remaining `window.confirm` prompts in Operations & System flows with `ConfirmDialog`; fixed Base-UI `<Select><option>` usage with `NamedSelect`; added `DataTable` `loading` skeletons + `AuditLogPage`/`DataCenterPage` retry states; fixed `OpsEmptyState` JSX `action` rendering and `.capp-vote-btn` dark-mode contrast. |
| Customer, Auth & Settings hardenings | **PASS** — Added required mobile contact to `/complaints` + `buildPublicInquiryRow`, `/shop` `BREDESIGN` shell & `44px` modal close target, `ChatbotSettingsPage` toggle rollback & Retry, `TintFinderSettingsPage` per-lead lock & Retry, `UserSettingsModal`/`CustomerMorePage` password toggles & error propagation, and `VouchersPage` active service filter. |
| Role docs & Design-system docs synced | **PASS** — Updated `docs/ops-chrome.md`, `docs/design-system/02-components.md`, `docs/guides/pages/customer-app.md`, and `docs/guides/roles/{sales,marketing,detailer,video-editor}.md`. |
| Automated checks (`npm run audit:api-auth`, `check`, `lint`, `npm test`, `npm run build`) | **PASS** — `43/43` `/api/*` auth handlers, all `5/5` `check:*` scripts, `0` ESLint errors, **2,816+** unit tests across **627+** suites (`0` failed), production Vite + prerender build verified. |
| Knowledge graph (`graphify-out/`) | **Updated** — `graphify update .` synced after code changes. |

## Prior Snapshot (2026-11-15 — Blog Redesign, Full CRUD & Services Hardening)

| Check | Result |
|-------|--------|
| Live Supabase migrations | **APPLIED & VERIFIED** — `20261115223000` (services/packages/detailing hardening) + `20261115233000` (`supabase_realtime` on `blogs`/`events`, least-privilege `anon` `SELECT` grants, `blogs_updated_at_idx`/`events_updated_at_idx`, `sync_cms_content_row()` triggers & constraints) |
| Blog contrast & live CRUD browser check (`verify_blogs_ui_e2e.mjs`) | **PASS** — `12.04:1` CTA button, `9.54:1` eyebrow, `15.78:1` related cards, `17.01:1` body prose; Full-Screen Live Preview (`1366x900`); full Create → Read → Update → Delete lifecycle; `0` console/page errors |
| Knowledge graph (`graphify-out/`) | **Updated** — `11,082` nodes, `29,592` edges, `911` communities |

## Prior Snapshot (2026-11-15 — UAT, Real Catalog & Staff Cutover)

| Check | Result |
|-------|--------|
| Lint (`npm run lint`) | **PASS** — `0` errors, `0` warnings |
| Unit suite (`npm test`) | **PASS** — **2,618 / 2,618** across **587** suites (`0` failed, `0` skipped) |
| Static checks (`npm run check`) | **PASS** — planning, portal-actions (`12`), settings-auth, customer-regression, live-queue-path |
| `/api/*` auth audit (`npm run audit:api-auth`) | **PASS** — `36` handlers scanned, `0` unauthenticated, `0` unscoped |
| Production build (`npm run build`) | **PASS** — 465 PWA precache entries |
| Role matrix (`e2e-role-qa-wave.mjs`) | **PASS** — **206 / 206** |
| Money / P0 / Forms UI (`e2e-ui-money`, `e2e-ui-p0`, `e2e-ui-forms`) | **PASS** — **5 / 5**, **9 / 9**, **10 / 10** |
| Money / Sales / Queue RPC (`e2e-daily-sheet-money`, `e2e-sales-bookings`, `e2e-plate-vehicle-queue`) | **PASS** — **38 / 38**, **14 / 14**, **13 / 13** |
| Responsive (`responsive-validation.mjs`) | **PASS** — `fail=0, conditional=0` across 9 viewports |
| Live domain (`e2e-main-domain-and-system-verify.mjs`) | **PASS** — **12 / 12** (`18/18` auth accounts, `10/10` GSC/SEO endpoints, CMS Studio draft round-trip) |
| Live real-data & staff probe (`/services`, `/book`, `/operations/pos`, 15 real staff logins) | **PASS** — `15/15` Supabase Auth logins, `0` console errors, `0` HTTP `4xx/5xx`, Coffees & Sellables verified on `/operations/pos` |
| Deep DB audit (`npm run audit:db`) | **Reconciled** (`1,309 / 1,309` sales); exits `1` only on known pre-existing items (`BUG-061` 2026-09-29 test handoffs, `0/34` push opt-in) |
| Knowledge graph (`graphify-out/`) | **Updated** — `11,046` nodes, `28,501` edges, `911` communities |

---

## Summary (2026-10-16 historical)

| Field | Value |
|-------|-------|
| Audit date | **2026-10-16** (Asia/Manila) — principal full-system audit · deep dive on undocumented / untested · architecture HTML |
| Gap map (this run) | [`qa/READINESS-GAP-2026-10-16.md`](./qa/READINESS-GAP-2026-10-16.md) — what is proven vs not tested vs still open |
| Daily ops + user pages | [`qa/DAILY-OPS-USER-PAGES-2026-10-16.md`](./qa/DAILY-OPS-USER-PAGES-2026-10-16.md) — shop-day + customer page evidence |
| Canonical readiness | [`qa/FULL-APP-READINESS-2026-10.md`](./qa/FULL-APP-READINESS-2026-10.md) |
| Remaining work (PM) | [`qa/REMAINING-WORK-2026-10.md`](./qa/REMAINING-WORK-2026-10.md) + gap map continue checklist |
| Architecture review | `%TEMP%\architecture-review-2026-10-16.html` — top pick: deepen **VehicleOwnership** |
| Nav walk (every role × every sidebar link) | **PASS** — `e2e:nav-walk` **87/87** (2026-10-15; includes `/operations/vehicle-transfer` for Boss/ASA/BA). Prior 84/84 on 2026-10-04. |
| September 2026 test month | **PASS** — verify-september **60/60** · Floor Board net ₱1,618,627.00 · [`qa/SEPTEMBER-2026-SEED.md`](./qa/SEPTEMBER-2026-SEED.md) |
| Statuses / overrides / approvals by role | **PASS** — `daily_flow_role_probe.sql` **20/20** (rolled back) |
| Shop-day DB probe | **PASS** — **19/19** · SoD **4/4** · RLS **24/24** · BUG-093 revoke **8/8** |
| Role matrix | **PASS** — `e2e:role-qa-wave` **179/179** (supersedes older 52/52 role-qa stamp) |
| Money UI pack | **PASS** — `e2e:ui-money` **5/5** |
| P0 UI | **PASS** — `e2e:ui-p0` **9/9** (solo; parallel flake ignored) |
| Daily Sheet money path | **PASS** — `e2e:daily-sheet-money` **38/38** |
| Web push wiring | Fake e2e **PASS** (2026-10-16); **0/20** staff devices enrolled (BUG-062) — real push **NOT VERIFIED** |
| Framework | Vite + React · Supabase Auth/RLS · PostgREST + `/api/*` |
| Build | **PASS** — `npm run build` (2026-10-16; lint apostrophe fix on VehicleTransferPage) |
| Unit suite | **PASS** — **2222/0** (`npm test`, 2026-10-16) |
| Lint | **PASS** — `npm run lint` exit 0 (2026-10-16) |
| Deploy | **PASS** — `main` / `f7ebc41` · Vercel Production Ready · live bundle has `vehicle-transfer` + history sentence |
| Soft-launch | **READY_WITH_OPS_BLOCKERS** — shop-day ready; **BUG-094 banner still on prod**; Vercel SMS + real push + Auth SMTP open |
| Responsive | **PASS** — `e2e:responsive` fail=0 (2026-10-16; prior stamp) |
| BusyBee egress (office) | **FAIL** — 2026-10-16 23:00: balanceOk false, ErrorCode -1, egressIp `180.190.249.98` (drift). Hakum not on this Vercel CLI team. |
| Staff push enroll | **0 / 20** active staff (`audit-db-deep auth`); 3 customer-only subs |
| Stranded handoffs | **2** pending (BUG-061 Low) — placeholder customers; do not POS |
| History banner (BUG-094) | Prod: clear-during-render **still live** on `f7ebc41`. Local fix: unit 14/14 + e2e 4/4 — **uncommitted** |
| `check-audit-p2` | **PASS** tonight — retargeted seams |
| Production messaging | **NOT MET** — BusyBee blocked; Auth SMTP open; **owner SMS N/A** |
| Transfer / walk-in guide | **Added** [`guides/pages/vehicle-transfer.md`](./guides/pages/vehicle-transfer.md) |

## Walk-in history and car transfer (2026-10-15 → deploy 2026-10-16)

| Check | Result |
|-------|--------|
| History attach on DB error | Account stays created. Response sets `history_warning`. Account home shows `HISTORY_ATTACH_WARNING`. It does not say "You have existing history with us." |
| Phone spellings | `sameHandset` treats spaces, dashes, and `+63` as one handset. Claim query uses a digit regex, then checks the canonical number. |
| Duplicate unowned plate | One row is claimed. Extra unowned rows are archived. A unique-key race is read again and claimed or refused. |
| Maintenance follows the car | Open `vehicle_maintenance_schedules` (`scheduled`, `notified`) get the buyer's id, name, and phone. |
| Branch Admin scope | SA and ASA: any car. Branch Admin: a visit at their assigned branch, or a car with no visits. |
| Audit failure | Vehicle owner and those maintenance rows are written back. The request returns 500. |
| Unit seam | `tests/vehicleTransferAndHistory.test.js` included in **2222** suite |
| Live signup / live transfer | **PASS** — `scripts/e2e-walkin-history-transfer.mjs` **10/10** (disposable accounts wiped): `existing_history`, spaced-phone claim, BA transfer + maintenance follow + reverse |
| Fake push wiring | **PASS** — `e2e-push-notifications.mjs` ok (2026-10-16) |
| POS voice | **PASS** — `_pos-voice-check.mjs` **13/13** (script now loads `.env` for demo passwords) |
| Production deploy | **DEPLOYED** — `f7ebc41` on Hakum Vercel Production |
| Vercel SMS / real staff push | **BLOCKED** / **0/20** enroll — see gap map |

## Customer home, packages, reviews, points (2026-09-28)

Scoped to the customer account, detailing booking, and Super Admin catalog. Not a full re-run of FLOPS or the role matrix.

| Surface | Result |
|---------|--------|
| Forecast line | **PASS** — `weatherForecastLine` (sunny / cloudy / rain / storms) under the temperature. Unit test green. |
| Empty active visit | **Hidden** — the “No active visit” card is not rendered. Book stays on the tile row. |
| Detailing packages | **Seeded** — Ceramic Premium/Platinum and four PPF tiers from the landing page, `parent_service_id` set. Tint and paint maintenance have no landing packages; Super Admin can add them on Service management. |
| Visit points | **Seeded** — carwash 1, express 2, tint 3, paint maintenance 3, ceramic 5, PPF 10. Editable per service on Memberships → scoring and on the service form. POS awards `points_award` (membership multiplier still applies). |
| Thumbs review | **Wired** — thumbs up opens `branches.google_review_url` when Super Admin has saved an https link for that branch. Links are empty until set. |
| Tests | **PASS** — `tests/loyaltyPoints.test.js`, `tests/branchWeather.test.js`, `tests/serviceReviews.test.js`, `tests/requestBriefE2e.test.js` (21/21). Lint on the touched files exit 0. Full `npm test` / browser walk **not re-run** this pass. |

## Finance and Reporting vs Xero (2026-09-28)

Scoped to `/operations/finance` against the owner's Xero P&L, chart of accounts, and Square yearly sales screenshots. Documentation and static review only. No product code changed, no FLOPS or browser re-run.

| Area | Result |
|------|--------|
| Purpose split | **Documented** — Finance = books (P&L, accounts, YTD, branch); Reporting = gross sales vs last year. [XERO-FINANCE-PURPOSE.md](OPS/XERO-FINANCE-PURPOSE.md) |
| Income source | **OK** — `finance_daily_pl` income is paid POS only |
| Discounts | **Gap (P2)** — `sales.discount_minor` stored but not a P&L line |
| Cost of sales / gross profit | **Missing** — not modeled |
| Chart of accounts | **Gap (P2)** — categories have no code; seed names differ from Xero 10–19 |
| Expense date | **Gap (P2)** — P&L dates expenses by `created_at`; no bill-date column |
| Compare | **Partial** — one prior window only; no 1–4 month columns or branch columns |
| This month vs YTD per account | **Missing** |
| Year-over-year gross sales chart | **Built (2026-09-29)**: Reports tab, period Year, gross by month vs last year to date |
| Square Home / Sales summary | **Built (2026-09-29)**: Dashboard tiles + Locations; Reports summary, payment types, top items; change vs prior period. `tests/salesSummary.test.js`, screenshots `e2e-evidence/square-finance/` |
| Checklist | [XERO-FINANCE-CHECKLIST.md](OPS/XERO-FINANCE-CHECKLIST.md): Square sales built; Xero P&L items not built yet |

## Critical Issues

| Severity | Area | Issue | Status |
|----------|------|-------|--------|
| Medium | Customer | History banner Strict Mode drop | **Open on prod** — BUG-094; fix local only |
| P1 ops | SMS | BrandTxt egress IP (**customer** outbound) | **Open** — office `sms:egress` ErrorCode **-1** on `180.190.249.98` (BUG-002); production still needs Hakum Static IPs |
| — | SMS | Owner daily SMS / `OWNER_SMS_PHONE` | **N/A** — disabled (`owner_sms_disabled`); Finance accept → web push only |
| P1 ops | Auth | Auth SMTP inbox proof | **Open** — Gate 10.1 ([`AUTH-SMTP-PROOF.md`](./OPS/AUTH-SMTP-PROOF.md)) |
| P1 ops | Deploy | Vercel Static IPs for Hakum | **Open** — Hakum absent from CLI team `jcuadys-projects` ([`VERCEL-STATIC-IPS.md`](./OPS/VERCEL-STATIC-IPS.md)) |
| Low ops | POS | Stranded `pos_handoffs` (BUG-061) | **Open** — 2 rows 2026-09-29; void/archive only after owner confirm (not revenue) |
| Medium | DX | Unit suite expected 7 API entrypoints; relay added 8th | **Closed** — routing test + `busybeeSendSmsDirect` / relay mode shipped this campaign |

## Functional Issues

| Page/Feature | Problem | Root Cause | Fix | Verified |
|--------------|---------|------------|-----|----------|
| BusyBee relay tests | Import missing exports | Relay tests landed before `resolveBusybeeSendMode` / `busybeeSendSmsDirect` | Implemented in `server/busybee.mjs` | 1284/1284 |
| Shop-day lifecycle | Needed fresh stamp for 2026-09-26 | Prior artifact was 2026-09-24 | Re-ran FLOPS (day clean) | 25/25 |
| CRM → Expense categories (SA / ASA finance_write) | List always empty; "Add category" failed | `CrmPage.jsx` selected/inserted `expense_categories.is_active` — column never existed (PostgREST 400) | Dropped `is_active` from select/insert/label | 2026-09-27 nav-walk 4xx 0; browser add → listed 6 → new row visible → cleaned up |

## UI/UX Issues

| Page/Component | Issue | Design Rule | Fix | Verified |
|----------------|-------|-------------|-----|----------|
| POS / Payroll / Finance | No redesign for soft-launch | Money path proven | Decision locked in ADMIN-DAILY-OPS-TRACKER | ops:daily-ops |
| Book page | Compact touch targets | Responsive CONDITIONAL | Accepted residual | Prior |

## Validation / Responsive / Accessibility

No new P0/P1 this campaign. Responsive not re-matrixed this hour (prior CONDITIONAL). A11y not end-to-end re-audited.

## Backend/API Issues

| Endpoint/Service | Problem | Fix | Verified |
|------------------|---------|-----|----------|
| BrandTxt SendSMS/Balance | Unauthorized IP | Ops whitelist + optional relay | sms:egress ErrorCode 11 |
| `run_payroll` overlap | Same-day second floor | By design | 2026-09-24 note; 2026-09-26 clean confirm |
| `catalog_line_kind` | Mutable search_path (advisor WARN) | Pinned `pg_catalog, public` | 2026-09-27 SQL check |
| `stamp_sale_line_kind` (trigger fn) | RPC-executable by anon/authenticated | Revoked EXECUTE (trigger fire unaffected) | FLOPS 25/25 after (sale lines still stamped) |
| `expense_reports`, `expense_report_lines`, `ops_pos_settings`, `role_definitions` | Multiple permissive SELECT policies | Split `FOR ALL` write into insert/update/delete; `role_definitions_select` = `is_staff() or is_super_admin()` (SA read was only via write policy) | Advisor WARN cleared; FLOPS + nav-walk green |
| Push fan-out (production data) | Only **3** push subscriptions exist — all demo customer; **0** SA/ASA/staff devices | Not a code bug — needs device opt-in | SA/ASA must enable notifications on their phones before soft-launch |
| Advisors left as-is (by design) | 4 `SECURITY DEFINER` public queue/home views (anon board), 3 RLS-no-policy tables (RPC-only), 51 authenticated definer RPCs (internal role checks; incl. the RLS branch-list helpers, 2026-10-04), 124 unused indexes (low traffic) | No change | Documented |
| Auth leaked-password protection | Disabled | Dashboard toggle (ops) | Open P2 |
| `bookings.final_checked_by` / `sent_to_payment_by` | FK to `customers`: TL / SA / ASA without a customer row could not reach Final check (BUG-046) | FK → `staff_profiles`; RPC stamps caller | Applied to prod 2026-10-04; role probe 20/20 |
| `sales` / `bookings` / `queue_events` read RLS | Helpers evaluated per row → ASA Floor Board 500, month of sales 1.3–3 s (BUG-047) | `(select …)` initPlans + `accessible_branch_slugs()` / `manageable_branch_slugs()` | Applied to prod 2026-10-04; read fingerprint identical (25 users); 140–640 ms |
| `/api/data-center`, `/api/public-inquiry` | Gateway file shadows its vercel.json rewrite → 404 without `?operation` (BUG-048) | `createGateway(…, { defaultOperation })` | **Closed live** 2026-10-05 (405 / 401) |

## Missing Features / Incomplete Implementations

| Area | Missing Behavior | Priority |
|------|------------------|----------|
| Production SMS egress | BrandTxt whitelist + Vercel Static IPs (or relay host) | P1 ops |
| Auth SMTP | Dashboard proof to real inbox | P1 ops |
| Deferred POS | Receipt/print, void/refund CRUD | P2 product |
| Full `test:readiness` orch | Not re-run this campaign (FLOPS+unit+integrity used) | P2 verify |

## Feature inventory (soft-launch bar)

| Feature | Frontend | Backend | Integration | Tests | Status |
|---------|----------|---------|-------------|-------|--------|
| Customer book / portal | Done | Done | FLOPS C1 | Unit + FLOPS | **Complete** |
| Crew attendance | Done | Done | FLOPS A1 | Unit + live | **Complete** |
| TL wash queue | Done | Done | FLOPS W* | Unit + FLOPS | **Complete** |
| BA POS + ~~EoS~~ | Done | Done | FLOPS W1/E1 | FLOPS 25/25 | **EoS RETIRED 2026-10-01** — BA closes via Daily Sheet; POS + Daily Sheet are live |
| SA Finance accept + P&L | Done | Done | FLOPS F1 | SQL + UI | **Complete** |
| ~~SA Floor payroll~~ | Retired | Retired | FLOPS P1 | 157500 confirmed (historical) | **RETIRED 2026-10-01** — replaced by Daily Sheet salary lines |
| RBAC denials | Done | Done | FLOPS R1 | TL POS / Investor payroll | **Complete** |
| Owner daily SMS | Done | Done | — | — | **N/A** (disabled) |
| Customer reminder SMS live | Done | Done | Ops IP | sms:egress | **BLOCKED** ops |
| Archify lifecycle diagram | Done | n/a | Artifact | prior deliver | **Complete** (claim unchanged) |

## Product / PM doc cross-check (2026-10-05 — after cutover)

| Artifact | Aligns with Daily Sheet money path? |
|----------|-------------------------------------|
| [`daily-sheet/README.md`](./daily-sheet/README.md) | **Yes** — canonical |
| [`architecture/daily-sheet.*.html`](./architecture/) | **Yes** |
| [`MONEY-CONTRACT.md`](./OPS/MONEY-CONTRACT.md) | **Yes** — triangle rewritten to Daily Sheet |
| [`SHOP-DAY-RUNBOOK.md`](./qa/SHOP-DAY-RUNBOOK.md) | **Yes** — Daily Sheet steps |
| [`shop-day-flow.md`](./user-stories/shop-day-flow.md) + [`user-stories/README.md`](./user-stories/README.md) | **Yes** |
| [`epic-shift-close.md`](./user-stories/epic-shift-close.md) / [`epic-payroll.md`](./user-stories/epic-payroll.md) | **Yes** — superseded banners + Daily Sheet ACs |
| [`qa/ROLE-STORY-EVIDENCE.md`](./qa/ROLE-STORY-EVIDENCE.md) | **Yes** — role × evidence matrix |
| [`qa/PUSH-CHECKLIST.md`](./qa/PUSH-CHECKLIST.md) | **Yes** — routing OK; **0 staff devices** called out |
| Owner PDFs `user-stories/pdf/process-*` | **Still stale** (HTML/PDF pack) — P2 |
| [`POS/`](./POS/) / [`PAYROLL/`](./PAYROLL/) flowchart packs | Historical archive |
| Full gap list | [`qa/REMAINING-WORK-2026-10.md`](./qa/REMAINING-WORK-2026-10.md) |

## Final Verification (2026-10-16)

- [x] Production build passes (`npm run build`, this audit)
- [ ] Type check — N/A (JS; no `tsc` script)
- [x] Lint passes (`npm run lint`, this audit; VehicleTransfer apostrophe fixed)
- [x] Automated tests pass (**2222/0**)
- [x] Critical money flows proven (Daily Sheet **38/38**; shop-day probe **19/19**; September **60/60**)
- [x] Nav + role wave (**87/87**, **179/179**)
- [x] Live walk-in signup history + transfer write — **PASS 10/10** (`e2e-walkin-history-transfer.mjs`)
- [x] Fake push wiring — **PASS**
- [x] POS voice — **PASS 13/13**
- [x] Responsive — **PASS** fail=0
- [x] Maintenance Arrive — **PASS 7/7** (`e2e-maintenance-arrive.mjs`)
- [ ] History banner UI — local **PASS 4/4**; production still BUG-094 until commit+deploy
- [ ] Staff push real devices + Vercel BusyBee DELIVRD + Auth SMTP — **NOT MET**
- [x] Gap map + daily-ops page map + transfer / customer guides
- [x] Architecture deepening report opened (temp HTML)

## Verdict

**Shop-day + customer account history/transfer/Arrive: READY for floor use.**  
**Full product “optimized and functional already”: NO** — Vercel SMS, staff push enroll, Auth SMTP remain.  
**Overall: READY_WITH_OPS_BLOCKERS — Continue.**

## Recommended Next Action (say Continue)

1. Hakum Vercel Static IPs + `BUSYBEE_*` → BrandTxt → production status SMS `DELIVRD`.  
2. Enable alerts on SA/ASA/BA/TL phones.  
3. Auth SMTP Gate 10.1 inbox proof.  
4. Optional: deepen VehicleOwnership.

## Daily sheet formulas (2026-10-20)

Scoped to the money path in `FOrmulas.md`. This is not a new click of every route. The 16 Oct stamps above were not re-run.

| Check | Result |
|---|---|
| Live `daily_sheet_server_totals` | **PASS** — `cashLeftMinor` / `gcashLeftMinor` on `lybxhpzzqqyqswvuwpxv`. Bacoor draft `a87dbc89…` cash expense 1000000 → cash left −1000000, GCash left 0. |
| Approve posts expenses and salaries, not cash advances | **PASS** — `review_daily_sheet(jsonb)` contains `expense` and `salary`; `ca_release` is absent. |
| POS payment list | **PASS** (settings row) — live `ops_pos_settings` is Cash, GCash, Credit Cards, Debit card, Bank transfer. A live debit or bank sale was **NOT VERIFIED** by click. Floor tiles now keep credit, debit, and bank transfer apart (20 Oct afternoon). |
| Ceramic vs same-day vs PPF | **FIXED** — live catalog: ceramic, tint, PPF, paint maintenance are `pay_category` detailing. Interior / exterior / mobile / glass are same-day. PPF `line_kind` is `ppf` even when the category says detailing, so film is not ceramic crew pay. Paint maintenance has its own sheet row. |
| Stock per size | **APPLIED** — `product_branch_stock.size_key` and POS deduct by `size_label`. Existing qty remains on `size_key ''`. |
| Cash Advance board | **APPLIED** — Employee Cash Advance `visible_roles` excludes Team Lead, Branch Admin, marketing, and Customer Rep. |
| Unit tests for this path | **PASS** — 98/98 on sheet, payment, and finance summary tests (20 Oct). Full `npm test`, lint, and build **NOT RE-RUN**. |
| Browser money click / responsive | **NOT VERIFIED** this pass. |
| Soft-launch | **Still blocked** — BusyBee IP and Auth SMTP unchanged. |

### Ask Sir

Answered 21 Oct 2026. See the checklist in `docs/daily-sheet/FORMULAS.md`.

## Daily sheet collection (2026-10-21)

Sir’s five answers are the contract. They replace the morning-float reading.

| Answer | Result |
|---|---|
| Total credit/debit transaction = credit card + debit card + bank transfer | On the sheet, the close slip, and `creditDebitMinor`. Still out of cash left and GCash left. |
| No morning float | The sheet no longer asks for one. Cash left is the collection. Over/short compares the count to cash left. |
| Cash advance comes off total sales and is not an expense | `totalSalesMinor` = paid POS − advances given. Expense total is still expenses + salaries. The channel that paid the advance still drops, so the drawer matches. |
| Salary comes out of the cash or GCash transaction, not again from what is left | `moneyLeft` and `daily_sheet_server_totals` both do this. |
| Split cash + GCash on one ticket | POS control, `sales.cash_minor` / `gcash_minor`, and the sheet attributes each portion. The ticket counts once. |

Live apply of `20261021120000_sheet_collection_no_float.sql` is on `lybxhpzzqqyqswvuwpxv`. Checked 21 Oct 2026: salary is subtracted once inside the channel transaction, submit no longer requires a float, and a split ticket can be stored. A live click of a split sale on the register is still **NOT VERIFIED**.

## NewChanges (2026-10-25)

Living checklist: `docs/plans/2026-10-25-new-changes-checklist.md`.

This pass shipped only the pieces that already match the database and the 19 Oct access sheet.

| Item | Result |
|---|---|
| POS shows the linked customer's points | **FIXED in code** — register loads `loyalty_points` with `loyalty_stamps` and prints them on the customer card. Browser click **NOT VERIFIED**. |
| Cash labels | **FIXED in code** — staff-facing “drawer” on the Daily Sheet and the close hint now say cash. The money math is unchanged. |
| Floor Insight | **FIXED in code** — nav and page title. Access is still Owner, Super Admin, and crew watch. |
| Administrative crew tiles | **REMOVED** from the floor page. Roster helper stays for tests. |
| Payroll e-sign, visit rewards, point catalog, inventory categories, restock approval | **NOT STARTED** |
| Cash advance remaining balance | **APPLIED** — `cash_advance_ledger` on the live project. Sheet, POS tab, My advances, and owner Floor Insight read the same lines. Browser click **NOT VERIFIED**. |
| Bills for-approval count and awaiting-payment amount | **FIXED in code** |
| P&L expense account opens its paid lines | **FIXED in code**. Browser click **NOT VERIFIED**. |
| Attendance Crew / Team Lead / Admin out of roster | **FIXED in code** |

No new SQL in this pass. No live migration.
