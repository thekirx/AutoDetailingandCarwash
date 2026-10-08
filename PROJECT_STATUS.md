# Project Status

**Last Updated:** 2026-10-08 (Asia/Manila) — deep read-only production DB audit; read-only guarantee proven by tests + revert-prove
**Current Branch:** `audit/2026-10-08-closeout` (unpushed; commit the doc and the count changes, so read `git rev-list --count origin/main..HEAD` rather than trusting a number here)
**Overall Status:** **READY_WITH_OPS_BLOCKERS** · money reconciles in production · push **0 of 19 staff enrolled** · 2 POS handoffs (₱5,397.50) stranded

## Executive Summary

Since 2026-10-01 the money path is **POS → Daily Sheet (Branch Admin) → Finance approve (Super Admin / ASA) → books**. End of shift, Payroll and My pay are retired. The Daily Sheet has a close-of-day slip (Print / PDF, CSV, Excel); Finance › Daily sheets has search, submitted by, net profit range, quick dates, over/short, and CSV / Excel / Print exports.

Dashboards (2026-10-04): the Floor Board money section follows the Timeline filter (Today / Week / Month / 3 / 6 months / custom) with gross, net, transactions, average and posted net profit vs the prior period, net sales by hour, payment-method and service bars, deductions (discounts, refunds, cancelled estimate, posted expenses) and an always-on per-branch table. POS Today (Branch Admin) adds discounts, refunds, money spent so far (from the daily sheet) and top services.

September 2026 test month (2026-10-04): Bacoor + Batangas have a realistic month in production — 1,221 bookings (1,141 completed cars), 1,288 sales, maintenance, attendance and 60 Daily Sheets reviewed by SA / ASA (approved, returned, reopened). Tagged and removable: [`docs/qa/SEPTEMBER-2026-SEED.md`](docs/qa/SEPTEMBER-2026-SEED.md). Queue, POS, Daily Sheets, P&L and Floor Board agree (**23/23**); screens per role **22/22**; statuses / overrides / approvals by role **20/20** (rolled-back probe).

Fixed while doing it: Team Leads without a customer record could not reach Final check (P0, production); Floor Board 500 for ASA and slow money pages (read policies now evaluate once per query, same access); public Complaints / Partnership / Events forms and SA Data Center 404 (BUG-048 — **closed on production 2026-10-05**: live 405 / 401). **BUG-048 can no longer recur silently**: `tests/apiRouteContract.test.js` fails the build if any `/api/*` path the app calls has neither a serverless function nor a `vercel.json` rewrite, and if any rewrite points at an operation its gateway does not export. That class of break was invisible to build, lint and unit tests — it only existed on the deployed host.

Fresh evidence: **2026-10-09** unit **1666/1666** (2 skipped) and lint **0**, re-verified against the current working tree. Prior **2026-10-04**: nav walk **84/84**, role matrix **52/52**, money UI **5/5**, P0 UI **9/9**, data integrity **PASS**, Daily Sheet live smoke **17/17**, money dashboards **39/39**. Daily Sheet money path **38/38** (2026-10-02). Role×story matrix: [`docs/qa/ROLE-STORY-EVIDENCE.md`](docs/qa/ROLE-STORY-EVIDENCE.md).

Future branch: production Dasma is `dasmarinas` (coming soon); staff hire works on coming-soon; junk `crudtest-*` branches archived. Opening day = flip Active in Branches (no code change). Shop-day **markdown** + **owner HTML/PDF pack** teach Daily Sheet; legacy `user-stories/pdf/process-*` may still be stale.

Production messaging remains **open**: BrandTxt ErrorCode **11** (server IP not whitelisted); Auth SMTP unproven. **Owner daily SMS is intentionally disabled** — Daily Sheet submit / approve use web push.

Canonical audit: [`docs/SYSTEM_AUDIT.md`](docs/SYSTEM_AUDIT.md) · Daily Sheet guide: [`docs/daily-sheet/README.md`](docs/daily-sheet/README.md) · Bugs: [`docs/qa/BUGS.md`](docs/qa/BUGS.md) · Architecture: [`docs/architecture/shop-day-flops.workflow.html`](docs/architecture/shop-day-flops.workflow.html)

## Production database audit (2026-10-08)

Read-only pass over production with the service-role key, because the anon role cannot see
the RLS-protected rows that matter most. **Nothing was written.** The read-only property is
asserted, not trusted: `tests/dbAuditSafety.test.js` (10 tests) fails the build if a mutating
call appears, and `scripts/revert-prove-db-audit.mjs` reintroduces each bug class and requires
the suite to go red. Report: [`e2e-evidence/db-audit/db-audit.json`](e2e-evidence/db-audit/db-audit.json).

| Area | Result |
|------|--------|
| Sales | 1,307 sales, 1,293 paid, **₱1,624,822.00** |
| Sale lines | **1,307 / 1,307** reconcile to their sale |
| Currency | uniform PHP; **0** sales carry a `transaction_id` (no double-count) |
| Bookings | 1,312 total — completed 1,172, cancelled 84, no_show 16, waiting 13, pending 11, for_payment 4, confirmed 6, in_progress 6 |
| Staff | 25 rows, 19 active, 1 BossMich; no unknown roles |
| Daily Sheets | 60 total (58 approved, 1 returned, 1 submitted); no negative money, no duplicate branch/day sheets, no cash advances posted to expenses |

Three findings, all in [`docs/qa/BUGS.md`](docs/qa/BUGS.md): **BUG-061** 2 POS handoffs
stranded since 2026-09-29 (**₱5,397.50** unbooked — operational, needs a Branch Admin to ring
them up); **BUG-062** push enrollment **0 of 19**, with 3 orphan subscriptions; **BUG-063** 4
`transactions` rows (₱2,400) stuck in a status no code path can settle — historical residue from a
defect already fixed on 2026-07-15, no money at risk.

**Correction, 2026-10-08.** This audit initially recorded `transactions` as a *dead* ledger with zero
references, because the reference search covered `src/`, `server/` and `api/` only. That was wrong:
the write path is in the database, not the app. `complete_pos_sale` settles the table
(`20260819081507…sql:155`) and the queue hand-off function creates rows in it
(`20260812133000…sql:233`). Chasing that produced a real contract now pinned by tests: the hand-off
creates `pending_payment` and the POS settles exactly `pending_payment`, so the two ends agree and
new money cannot strand. The 4 stuck rows date to 2026-07-07/10, the window when migration
`20260707132730` inserted `pending` instead; `20260715153235` corrected it. **The defect is fixed and
is not recurring.** The lesson generalises: a reference search over application code cannot
establish that a table is unused when database functions can reach it.

**Correction, 2026-10-09 — BUG-061 downgraded to Low.** I first filed the two incomplete POS hand-offs
(₱5,397.50) as a High unbooked-revenue blocker and told the reader to ring them up at POS. **That
advice would have been wrong.** The only customers behind them are `Walk-in · ABC124`
(phone `0912345678`) and `test run` (phone `09999999999`, first/last name literally test/run), both
auto-created minutes before their hand-off, and **neither has ever produced a single sale**.
2026-09-29 is the *only* hand-off day with anything incomplete, and it is *only* days where 100% of
customers look like placeholders. Ringing them up would post **₱5,100 of test data into the real
books**. They are stale rows to void or archive, not revenue to collect. Confirm it was a POS test
day before touching them.

## Daily Sheet verification status (2026-10-09)

**The POS → Daily Sheet → Finance approve → books path has never run on real data.** All **60 of 60**
`daily_sheets` are September 2026, which is the seeded demo month. Real POS activity is **9 sales**
(4 August, 5 July) and **not one of them has a Daily Sheet**. Every "money reconciles" result to date
validates POS ↔ line items and seed arithmetic — never a sheet a Branch Admin closes at 6pm.

A full reconciliation (`npm run audit:db`, or `scripts/probe-daily-sheets.mjs`) compares each sheet's
`totals` block against the real `sales` for that branch/day, plus its own arithmetic. It found **108
discrepancies — all of them in the seeded month**, so none is a production money bug, and the audit
now reports them as `Info` seed artifacts while still escalating any drift outside September to
`High`. Side effect worth knowing: **the seeded demo month is not a faithful model of a real sheet**,
which is a problem for training material and for anyone demoing the Daily Sheet.

To close this honestly: close one real shop day end to end and re-run the probe.

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
| `e2e:role-qa-wave` | **179/179** (2026-10-08). First run read 166/169 with `fatal: Execution context was destroyed` and an immediate re-run gave 179/179 — a navigation race, not a product fault. **BUG-064, closed**: `scripts/lib/safe-evaluate.mjs` retries the race instead of letting it abort the run and silently drop ~10 checks. A gate that fails for reasons unrelated to the product is a gate people learn to ignore |
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
- **Push delivery:** the path itself is **proven sound** (2026-10-08) — `POST /api/push-subscribe` returns `401 {"error":"Sign in required"}` on production rather than 404, `handlePushSubscribeRequest` keys each row on `auth.getUser(token).id`, and `sendWebPushToUsers` prunes endpoints that answer 404/410. The 3 rows in `push_subscriptions` all belong to `demo.customer@hakumautocare.com` (`role: customer`), **not** to staff and **not** orphans. So **0 of 19 staff** is a pure enrollment gap: each member enables alerts on their own device. Not a code fix, and none is proposed ([`PUSH-CHECKLIST.md`](docs/qa/PUSH-CHECKLIST.md)).
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
