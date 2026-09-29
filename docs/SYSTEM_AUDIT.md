# System Audit

## Summary

| Field | Value |
|-------|-------|
| Audit date | **2026-09-27** (Asia/Manila) — untested pages, push, backend pass (builds on 2026-09-26 daily-ops verify) |
| Nav walk (every role × every sidebar link) | **PASS** — `e2e:nav-walk` **92/92**, backend 4xx **0** · `e2e-evidence/nav-walk/` |
| Role matrix | **PASS** — `e2e:role-qa` **54/54** (11 staff personas + customer + public forms) |
| Web push wiring | **PASS** — `e2e-push-notifications.mjs` incl. Finance accept → SA/ASA push (owner SMS off) |
| Supabase advisors | **Hardened** — migration `20260927120000_advisor_hardening_split_write_policies.sql` applied; FLOPS 25/25 re-run after |
| Branch / HEAD | `main` @ `59c27e0` (fast-forward pulled; homepage polish + prior FLOPS/SMS ops) |
| Framework | Vite + React · Supabase Auth/RLS · PostgREST + `/api/*` |
| Build | **PASS** — `npm run build` exit 0 |
| Unit suite | **PASS** — **1284/1284** (`npm test`) |
| Lint | **PASS** — `npx eslint .` exit 0 |
| FLOPS shop-day | **PASS** — `e2e:lifecycle-flops` **25/25** · `e2e-evidence/lifecycle-flops/` (Manila **2026-09-26**) |
| Data integrity | **PASS** — `e2e:integrity` |
| POS handoff smoke | **PASS** — `smoke-pos-handoff.mjs` (no pending / exit 0) |
| Daily-ops package | **PASS** — `npm run ops:daily-ops` exit 0 (`redesignRequired: false`) |
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
| Advisors left as-is (by design) | 4 `SECURITY DEFINER` public queue/home views (anon board), 3 RLS-no-policy tables (RPC-only), 44 authenticated definer RPCs (internal role checks), 124 unused indexes (low traffic) | No change | Documented |
| Auth leaked-password protection | Disabled | Dashboard toggle (ops) | Open P2 |

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

## Product / PM doc cross-check (2026-09-26)

| Artifact | Aligns with money triangle? |
|----------|----------------------------|
| [`SHOP-DAY-RUNBOOK.md`](./qa/SHOP-DAY-RUNBOOK.md) | Yes — BA POS → EoS → Finance → Payroll |
| [`shop-day-flow.md`](./user-stories/shop-day-flow.md) | Yes — paid POS ≠ close fiction |
| [`MONEY-CONTRACT.md`](./OPS/MONEY-CONTRACT.md) | Yes — payroll from paid POS + attendance |
| [`POS/09-FLOWCHARTS`](./POS/09-FLOWCHARTS.md) / [`PAYROLL/10-FLOWCHARTS`](./PAYROLL/10-FLOWCHARTS.md) | Present |
| [`shop-day-flops.workflow.html`](./architecture/shop-day-flops.workflow.html) | Present; claim unchanged (no Archify re-deliver) |
| [`epic-daily-operations.md`](./user-stories/epic-daily-operations.md) | Acceptance checked; seams pass |

## Final Verification

- [x] Production build passes
- [ ] Type check — N/A (JS; no `tsc` script)
- [x] Lint passes
- [x] Automated tests pass (**1284/1284**)
- [x] Critical user flows tested (FLOPS **25/25** this campaign)
- [x] Permissions verified (FLOPS R1)
- [x] Known blockers documented (SMS/SMTP/Static IPs)
- [x] `PROJECT_STATUS.md` updated

## Verdict

**Soft-launch shop-day code gate: MET** (fresh FLOPS 2026-09-26; re-run 25/25 on 2026-09-27 after DB hardening).  
**Every role × every sidebar page: PASS** (nav-walk 92/92, one CRM bug fixed).  
**100% production ops gate: NOT MET** (BrandTxt IP + Auth SMTP + Vercel Static IPs).  
**Overall: READY_WITH_OPS_BLOCKERS.**

## Recommended Next Action

1. Malcolm: send [`brandtxt-dexter-followup.txt`](./OPS/brandtxt-dexter-followup.txt) → Dexter; then prove `sms:egress` DELIVRD.  
2. Enable Hakum Vercel Static IPs (or deploy relay) and whitelist those IPs.  
3. Close Auth SMTP Gate 10.1 with real-inbox proof.
4. BossMich (and any ASA with finance_write) enable push on their phones — today zero ops devices are subscribed, so Finance-accept push reaches nobody.
5. Optional: enable Auth leaked-password protection in the Supabase dashboard.
