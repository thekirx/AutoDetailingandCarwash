# System Audit

## Summary

| Field | Value |
|-------|-------|
| Audit date | **2026-10-05** (Asia/Manila) — principal remaining-work / doc-debt audit; shop-day evidence from 2026-10-04 |
| Remaining work (PM) | [`qa/REMAINING-WORK-2026-10.md`](./qa/REMAINING-WORK-2026-10.md) — continue: doc cutover, ops SMS/SMTP/push, FLOPS rewrite |
| Nav walk (every role × every sidebar link) | **PASS** — `e2e:nav-walk` **84/84** (2026-10-04). BUG-048 **closed live** 2026-10-05 (`/api/public-inquiry` 405, `/api/data-center` 401) · `e2e-evidence/nav-walk/` |
| September 2026 test month (production, tagged, wipeable) | **PASS** — `scripts/verify-september-2026.mjs` **23/23** (queue ↔ POS ↔ daily sheets ↔ P&L ↔ Floor Board), `_september-shots.mjs` **22/22** at 375 / 1440 (SA, ASA, both BAs, TL) · [`qa/SEPTEMBER-2026-SEED.md`](./qa/SEPTEMBER-2026-SEED.md) |
| Statuses / overrides / approvals by role | **PASS** — `supabase/tests/daily_flow_role_probe.sql` **20/20** (rolled back): TL lifecycle incl. failed QA + send to payment, cross-branch + crew denials, BA / ASA / SA overrides, BA cannot approve own sheet, ASA can |
| Role matrix | **PASS** — `e2e:role-qa` **52/52**. Branch Admin is now denied the Queue (only SA, ASA, TL, Ops Lead); the stale "BA may open Queue" expectation was fixed |
| Money UI pack | **PASS** — `e2e:ui-money` **5/5** (TL denied POS, BA denied Queue, BA POS + Daily sheet, SA Finance › Daily sheets); End of shift steps removed |
| P0 UI | **PASS** — `e2e:ui-p0` **9/9** |
| Daily Sheet money path (live, sandbox day wiped) | **PASS** — `e2e:daily-sheet-money` **38/38** (2026-10-02) |
| Daily Sheet live UI (read-only, incl. slip Print / CSV / Excel, filters, list exports) | **PASS** — `scripts/_daily-sheet-live-smoke.mjs` **17/17** |
| Money dashboards 375 / 768 / 1440 (read-only, full page) | **PASS** — `scripts/_ops-pages-shots.mjs` **39/39** (incl. Floor Board on "3 months" with real sales; totals match SQL: ₱28,696.00, 17 paid), every page ready in ~1.6–2.6 s · `e2e-evidence/ops-pages/` |
| Floor Board / POS Today depth | **Built (2026-10-04)** — Floor Board money follows the Timeline with % vs prior, hourly chart, method / service bars, per-branch table; POS Today adds discounts, refunds, spent so far, top services. `floorCompareWindow` / `floorMoneyBreakdown` / `topServices` in `tests/dailySheet.test.js` |
| Web push wiring | Unit-proven for `sheet_submitted` / `sheet_reviewed`; real-device audit **NOT RE-RUN** since the Daily Sheet |
| Supabase advisors | **Hardened** — migration `20260927120000_advisor_hardening_split_write_policies.sql` applied |
| Framework | Vite + React · Supabase Auth/RLS · PostgREST + `/api/*` |
| Build | **PASS** — `npm run build` exit 0 (fresh 2026-10-05) |
| Unit suite | **PASS** — **1474/1474** (`npm test`, fresh 2026-10-05; future-branch + sheet_reviewed recipients) |
| Future branch / People hire | **PASS** — Dasma slug `dasmarinas` in prod; coming-soon hire; Detailer/Video branch picker; junk branches archived |
| Lint | **PASS** — `npx eslint .` exit 0 (fresh 2026-10-05) |
| FLOPS shop-day | **NOT RE-RUN** since 2026-09-26 (25/25 then). It completes a real paid sale on production that would land on the live Daily Sheet; the money path is covered by `e2e:daily-sheet-money` on a wiped sandbox day |
| Data integrity | **PASS** — `e2e:integrity` (2026-10-04) |
| POS handoff smoke | **NOT RE-RUN** since 2026-09-26 (exit 0 then) |
| Daily-ops package | **NOT RE-RUN** since 2026-09-26 (exit 0 then) |
| Branch / HEAD | `main` (see `git log`; Daily Sheet commits `ff0477d` → latest) |
| Soft-launch | **READY_WITH_OPS_BLOCKERS** |
| Production messaging | **NOT MET** — BrandTxt IP + Auth SMTP open; **owner SMS N/A** |
| BusyBee relay code | **PASS** — `resolveBusybeeSendMode` / relay handler / `api/busybee-relay.js` (unit seams green) |

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
| P1 ops | SMS | BrandTxt egress IP (**customer** outbound) | **Open** — ErrorCode 11 on `180.191.244.237` (BUG-002) |
| — | SMS | Owner daily SMS / `OWNER_SMS_PHONE` | **N/A** — disabled (`owner_sms_disabled`); Finance accept → web push only |
| P1 ops | Auth | Auth SMTP inbox proof | **Open** — Gate 10.1 ([`AUTH-SMTP-PROOF.md`](./OPS/AUTH-SMTP-PROOF.md)) |
| P1 ops | Deploy | Vercel Static IPs for Hakum | **Open** — project not on this CLI team ([`VERCEL-STATIC-IPS.md`](./OPS/VERCEL-STATIC-IPS.md)) |
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
| BA POS + EoS | Done | Done | FLOPS W1/E1 | FLOPS 25/25 | **Complete** |
| SA Finance accept + P&L | Done | Done | FLOPS F1 | SQL + UI | **Complete** |
| SA Floor payroll | Done | Done | FLOPS P1 | 157500 confirmed | **Complete** |
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

## Final Verification

- [x] Production build passes
- [ ] Type check — N/A (JS; no `tsc` script)
- [x] Lint passes
- [x] Automated tests pass (**1465/1465**, fresh 2026-10-05)
- [x] Critical user flows tested (Daily Sheet money path **38/38**; nav walk **84/84**; FLOPS not re-run — see Summary)
- [x] Permissions verified (role matrix **52/52**)
- [x] Known blockers documented (SMS/SMTP/Static IPs + **P1 doc debt**)
- [x] `PROJECT_STATUS.md` + [`qa/REMAINING-WORK-2026-10.md`](./qa/REMAINING-WORK-2026-10.md) updated

## Verdict

**Soft-launch shop-day code gate: MET** on the Daily Sheet money path.  
**Every role × every sidebar page: PASS** (nav load / allow-deny — not full story acceptance).  
**Documentation cutover: NOT MET** — staff/owner stories still teach End of shift / Payroll.  
**100% production ops gate: NOT MET** (BrandTxt IP + Auth SMTP + Vercel Static IPs + 0 staff push devices).  
**Overall: READY_WITH_OPS_BLOCKERS — continue.**

## Recommended Next Action

1. **Doc cutover (P1):** rewrite shop-day user stories, runbook, MONEY-CONTRACT body, owner PDFs → Daily Sheet ([`REMAINING-WORK-2026-10.md`](./qa/REMAINING-WORK-2026-10.md) track A).  
2. Malcolm: BrandTxt IP / Static IPs → prove `sms:egress` DELIVRD.  
3. Close Auth SMTP Gate 10.1 with real-inbox proof.  
4. BossMich / approving ASA enable push → `PUSH_AUDIT=1 node scripts/push-audit-events.mjs`.  
5. Rewrite or retire `e2e:lifecycle-flops` for Daily Sheet.  
6. Owner: wipe or keep September seed; set branch Google review URLs.
