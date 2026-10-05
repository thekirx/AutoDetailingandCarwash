# Project Status

**Last Updated:** 2026-10-05 (Asia/Manila) — future-branch / People RBAC readiness + remaining-work audit  
**Current Branch:** `main` (local ahead until push)  
**Overall Status:** **READY_WITH_OPS_BLOCKERS** (soft-launch shop-day) · future branch hire path **ready** · **doc cutover incomplete**

## Executive Summary

Since 2026-10-01 the money path is **POS → Daily Sheet (Branch Admin) → Finance approve (Super Admin / ASA) → books**. End of shift, Payroll and My pay are retired. The Daily Sheet has a close-of-day slip (Print / PDF, CSV, Excel); Finance › Daily sheets has search, submitted by, net profit range, quick dates, over/short, and CSV / Excel / Print exports.

Dashboards (2026-10-04): the Floor Board money section follows the Timeline filter (Today / Week / Month / 3 / 6 months / custom) with gross, net, transactions, average and posted net profit vs the prior period, net sales by hour, payment-method and service bars, deductions (discounts, refunds, cancelled estimate, posted expenses) and an always-on per-branch table. POS Today (Branch Admin) adds discounts, refunds, money spent so far (from the daily sheet) and top services.

September 2026 test month (2026-10-04): Bacoor + Batangas have a realistic month in production — 1,221 bookings (1,141 completed cars), 1,288 sales, maintenance, attendance and 60 Daily Sheets reviewed by SA / ASA (approved, returned, reopened). Tagged and removable: [`docs/qa/SEPTEMBER-2026-SEED.md`](docs/qa/SEPTEMBER-2026-SEED.md). Queue, POS, Daily Sheets, P&L and Floor Board agree (**23/23**); screens per role **22/22**; statuses / overrides / approvals by role **20/20** (rolled-back probe).

Fixed while doing it: Team Leads without a customer record could not reach Final check (P0, production); Floor Board 500 for ASA and slow money pages (read policies now evaluate once per query, same access); public Complaints / Partnership / Events forms and SA Data Center 404 (BUG-048 — **closed on production 2026-10-05**: live 405 / 401).

Fresh evidence: **2026-10-05** unit **1473/1473** (includes `futureBranchReady`). Prior **2026-10-04**: lint **0**, build **0**, nav walk **84/84**, role matrix **52/52**, money UI **5/5**, P0 UI **9/9**, data integrity **PASS**, Daily Sheet live smoke **17/17**, money dashboards **39/39**. Daily Sheet money path **38/38** (2026-10-02). Principal gap list: [`docs/qa/REMAINING-WORK-2026-10.md`](docs/qa/REMAINING-WORK-2026-10.md).

Future branch: production Dasma is `dasmarinas` (coming soon); staff hire works on coming-soon; junk `crudtest-*` branches archived. Opening day = flip Active in Branches (no code change).

Production messaging remains **open**: BrandTxt ErrorCode **11** (server IP not whitelisted); Auth SMTP unproven. **Owner daily SMS is intentionally disabled** — Daily Sheet submit / approve use web push.

Canonical audit: [`docs/SYSTEM_AUDIT.md`](docs/SYSTEM_AUDIT.md) · Daily Sheet guide: [`docs/daily-sheet/README.md`](docs/daily-sheet/README.md) · Bugs: [`docs/qa/BUGS.md`](docs/qa/BUGS.md) · Architecture: [`docs/architecture/shop-day-flops.workflow.html`](docs/architecture/shop-day-flops.workflow.html)

## SMS product policy (always)

- BusyBee / BrandTxt: **outbound only** (status + reminders). **No inbound / no reply inbox.**
- **No owner daily close SMS** — Daily Sheet submit / approve notify by **web push**.
- Optional fixed-egress path: `BUSYBEE_RELAY_URL` + `api/busybee-relay.js` (unit-proven); still needs a whitelisted host IP.

## Fresh verification (2026-10-04)

| Check | Result |
|-------|--------|
| `npm test` | **1465/1465** |
| `npx eslint .` | exit **0** |
| `npm run build` | exit **0** |
| `e2e:nav-walk` (every role × every sidebar link) | **84/84** (2026-10-04); BUG-048 Data Center / public-inquiry **closed live** 2026-10-05 |
| `scripts/verify-september-2026.mjs` (read-only) | **23/23** |
| `scripts/_september-shots.mjs` (read-only, SA / ASA / BA ×2 / TL, 375 + 1440) | **22/22** on production |
| `supabase/tests/daily_flow_role_probe.sql` (rolled back) | **20/20** |
| `e2e:role-qa` | **52/52** (Branch Admin denied Queue by design) |
| `e2e:ui-money` | **5/5** (rewritten for the Daily Sheet) |
| `e2e:ui-p0` | **9/9** |
| `e2e:integrity` | **PASS** |
| `scripts/_daily-sheet-live-smoke.mjs` (read-only, aborts writes) | **17/17** local + production |
| `scripts/_ops-pages-shots.mjs` (money dashboards, full page, 3 widths, incl. Floor Board on "3 months" with real sales) | **39/39**, ready in ~1.6–2.6 s |
| `e2e:daily-sheet-money` (live RPCs, sandbox day wiped) | **38/38** (2026-10-02) |
| `e2e:lifecycle-flops` | **NOT RE-RUN** — it completes a real paid sale on production that would land on the live Daily Sheet |
| Real-device push audit (`push-audit-events.mjs`) | **NOT RE-RUN** since the Daily Sheet |

## Soft-launch vs production

| Gate | Status |
|------|--------|
| Soft-launch shop-day (Daily Sheet money path) | **MET** (2026-10-04) |
| Production SMS / SMTP / Static IPs | **NOT MET** |
| Archify shop-day map | **MET** (claim unchanged) |

## Known follow-ups

- Dropping the locked payroll tables needs a separate migration and the owner's OK.
- `20260929090000_visit_stamp.sql` is unapplied on production; no app code calls it.
- Production has no real Daily Sheet yet; the 60 September seed sheets show the lists, filters and review drawer in a browser. **Wipe the September test month before go-live** (`scripts/seed/wipe-september-2026.sql`) or keep it as training data — owner's call.
- **P1 documentation debt:** many user stories / runbook / MONEY-CONTRACT body still describe End of shift → Payroll (superseded by Daily Sheet). Track: [`docs/qa/REMAINING-WORK-2026-10.md`](docs/qa/REMAINING-WORK-2026-10.md).
- `send_queue_ticket_to_payment` still fills `transactions.recorded_by` from a customers lookup, so the pending-payment transaction has no recorder for most staff (the paid sale records the cashier). Low; not on the money path.
- Xero gaps by choice: aged payables, balance sheet, bank reconciliation, VAT.
- Floor Board money pages all sales in the timeline in the browser (1000 rows per request). Fine at today's volume; move to an RPC if 6-month all-branch views get slow.
- Ops Lead still sees the flat Financials tiles on the Floor Board (pre-existing; the new money panel is SA / ASA finance view only). Decide whether Ops Lead should see money at all.

## Recommended Next Action

**Continue — not finished.** Pick a track from [`docs/qa/REMAINING-WORK-2026-10.md`](docs/qa/REMAINING-WORK-2026-10.md):

1. **A — Documentation cutover** (user stories + runbook + MONEY-CONTRACT + owner PDFs → Daily Sheet). Highest honesty risk if staff train on old EoS/Payroll docs.  
2. **B — Ops proofs** — BrandTxt IP / Static IPs → `sms:egress` DELIVRD; Auth SMTP inbox; SA/ASA enable push → push audit.  
3. **C — Rewrite `e2e:lifecycle-flops`** for Daily Sheet (old script still mutates retired RPCs).  
4. **Owner call:** wipe September seed before go-live, or keep as training data.
