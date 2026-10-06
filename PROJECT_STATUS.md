# Project Status

**Last Updated:** 2026-10-07 (Asia/Manila) — principal full-system audit; gates re-verified, doc/money-contract drift fixed  
**Current Branch:** `main`  
**Overall Status:** **READY_WITH_OPS_BLOCKERS** · shop-day **docs + owner pack aligned** · push **routing OK / 0 staff devices** · SMS **not tested**

## Executive Summary

Since 2026-10-01 the money path is **POS → Daily Sheet (Branch Admin) → Finance approve (Super Admin / ASA) → books**. End of shift, Payroll and My pay are retired. The Daily Sheet has a close-of-day slip (Print / PDF, CSV, Excel); Finance › Daily sheets has search, submitted by, net profit range, quick dates, over/short, and CSV / Excel / Print exports.

Dashboards (2026-10-04): the Floor Board money section follows the Timeline filter (Today / Week / Month / 3 / 6 months / custom) with gross, net, transactions, average and posted net profit vs the prior period, net sales by hour, payment-method and service bars, deductions (discounts, refunds, cancelled estimate, posted expenses) and an always-on per-branch table. POS Today (Branch Admin) adds discounts, refunds, money spent so far (from the daily sheet) and top services.

September 2026 test month (2026-10-04): Bacoor + Batangas have a realistic month in production — 1,221 bookings (1,141 completed cars), 1,288 sales, maintenance, attendance and 60 Daily Sheets reviewed by SA / ASA (approved, returned, reopened). Tagged and removable: [`docs/qa/SEPTEMBER-2026-SEED.md`](docs/qa/SEPTEMBER-2026-SEED.md). Queue, POS, Daily Sheets, P&L and Floor Board agree (**23/23**); screens per role **22/22**; statuses / overrides / approvals by role **20/20** (rolled-back probe).

Fixed while doing it: Team Leads without a customer record could not reach Final check (P0, production); Floor Board 500 for ASA and slow money pages (read policies now evaluate once per query, same access); public Complaints / Partnership / Events forms and SA Data Center 404 (BUG-048 — **closed on production 2026-10-05**: live 405 / 401).

Fresh evidence: **2026-10-07** unit **1518/1518** and lint **0** / build **0**, re-verified against the current working tree. Prior **2026-10-04**: nav walk **84/84**, role matrix **52/52**, money UI **5/5**, P0 UI **9/9**, data integrity **PASS**, Daily Sheet live smoke **17/17**, money dashboards **39/39**. Daily Sheet money path **38/38** (2026-10-02). Role×story matrix: [`docs/qa/ROLE-STORY-EVIDENCE.md`](docs/qa/ROLE-STORY-EVIDENCE.md).

Future branch: production Dasma is `dasmarinas` (coming soon); staff hire works on coming-soon; junk `crudtest-*` branches archived. Opening day = flip Active in Branches (no code change). Shop-day **markdown** + **owner HTML/PDF pack** teach Daily Sheet; legacy `user-stories/pdf/process-*` may still be stale.

Production messaging remains **open**: BrandTxt ErrorCode **11** (server IP not whitelisted); Auth SMTP unproven. **Owner daily SMS is intentionally disabled** — Daily Sheet submit / approve use web push.

Canonical audit: [`docs/SYSTEM_AUDIT.md`](docs/SYSTEM_AUDIT.md) · Daily Sheet guide: [`docs/daily-sheet/README.md`](docs/daily-sheet/README.md) · Bugs: [`docs/qa/BUGS.md`](docs/qa/BUGS.md) · Architecture: [`docs/architecture/shop-day-flops.workflow.html`](docs/architecture/shop-day-flops.workflow.html)

## SMS product policy (always)

- BusyBee / BrandTxt: **outbound only** (status + reminders). **No inbound / no reply inbox.**
- **No owner daily close SMS** — Daily Sheet submit / approve notify by **web push**.
- Optional fixed-egress path: `BUSYBEE_RELAY_URL` + `api/busybee-relay.js` (unit-proven); still needs a whitelisted host IP.

## Fresh verification (2026-10-04)

| Check | Result |
|-------|--------|
| `npm test` | **1518/1518** (2026-10-07) |
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
| `e2e:lifecycle-flops` | Script **Daily Sheet–aware** (read-only today sheet); money writes on `e2e:daily-sheet-money`. **Live re-run deferred** (would pay a real sale onto today’s sheet) |
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
- **Push delivery:** routing unit-proven; **0 staff** push subscriptions — BossMich / ASA / BAs must Enable alerts before soft-launch night ([`PUSH-CHECKLIST.md`](docs/qa/PUSH-CHECKLIST.md)).
- **P2 docs:** legacy per-process PDFs under `docs/user-stories/pdf/` may still show old close/pay — prefer the regenerated OWNER pack.
- `send_queue_ticket_to_payment` still fills `transactions.recorded_by` from a customers lookup, so the pending-payment transaction has no recorder for most staff (the paid sale records the cashier). Low; not on the money path.
- Xero gaps by choice: aged payables, balance sheet, bank reconciliation, VAT.
- Floor Board money pages all sales in the timeline in the browser (1000 rows per request). Fine at today's volume; move to an RPC if 6-month all-branch views get slow.
- Ops Lead still sees the flat Financials tiles on the Floor Board (pre-existing; the new money panel is SA / ASA finance view only). Decide whether Ops Lead should see money at all.

## Uncommitted work at risk (2026-10-07)

`main` is level with `origin/main` at `1e0311b`, but the working tree carries a **whole uncommitted work unit**:

| Area | Uncommitted |
|------|-------------|
| Source | 33 files, ~1,250 insertions / ~600 deletions across `src/`, `server/`, `vite.config.js` |
| **Untracked source** | `src/lib/branchListFilter.js` — **imported by `BranchesManagePage.jsx`** |
| **Untracked migrations** | `20261006120000_attendance_geo_spoof_alerts.sql`, `20261006130000_archive_e2e_leftovers.sql` — **already applied in production** |
| Untracked tests | `tests/branchListFilter.test.js`, `tests/crudCreateModals.test.js`, `tests/bookingCalendarControlled.test.js` |
| Untracked script | `scripts/_dead-button-crawl.mjs` |
| Docs | 19 files, incl. `CHANGELOG.md`, `MONEY-CONTRACT.md`, this file |
| Evidence | 211 modified + 389 untracked PNG/txt under `e2e-evidence/` |
| Scratch | **220 untracked `tmp-*.txt`** at repo root, none covered by `.gitignore` |

Risk: production already runs `geo_clock_in` and has `attendance_location_alerts`, but neither the migration nor the client code is in git. A clean clone cannot rebuild the database or that feature, and `git clean` would delete the migrations outright. `HEAD` itself is self-consistent and still builds — this is durability risk, not a broken `main`.

## Recommended Next Action

**Continue — not finished.** See [`docs/qa/ROLE-STORY-EVIDENCE.md`](docs/qa/ROLE-STORY-EVIDENCE.md).

1. **Push:** BossMich, Luci (ASA), each Branch Admin → Account → **Enable alerts** → Test alert. Re-run `PUSH_AUDIT=1` after that. **Do not test SMS yet.**  
2. Archive or ignore legacy `user-stories/pdf/process-*` (OWNER pack is current).  
3. Persona deep QA (Sales / Marketing / Video / Customer portal).  
4. Owner: wipe September seed before go-live?
