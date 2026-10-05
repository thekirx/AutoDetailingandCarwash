# September 2026 test data (Bacoor + Batangas)

A realistic month of shop days in production so the whole daily flow can be checked with real screens:
completed cars, bookings, maintenance, crew attendance, and a Daily Sheet for every branch-day reviewed by SA / ASA.
Everything is tagged and removable in one transaction.

## Commands

| Step | Command | Writes |
|---|---|---|
| Plan only (counts) | `node scripts/seed-september-2026.mjs` | nothing |
| Seed | `node scripts/seed-september-2026.mjs --apply` | Supabase project in `.env` |
| Finish sheets after a stop | `node scripts/seed-september-2026.mjs --resume-sheets` | daily sheets still in draft |
| Check accuracy | `node scripts/verify-september-2026.mjs` | nothing (23 checks) |
| Check screens | `BASE_URL=https://auto-detailingand-carwash.vercel.app node scripts/_september-shots.mjs` | nothing (blocks writes; 22 shots in `e2e-evidence/september-2026/`) |
| Remove | run `scripts/seed/wipe-september-2026.sql` (SQL editor or MCP `execute_sql`) | deletes seed rows, prints leftover counts (all 0) |
| Unit tests | `node --test tests/septemberSeed.test.js` | nothing |

The plan is deterministic (`scripts/seed/september2026Plan.mjs`, seed `20260901`): the same input gives the same rows.
Preflight refuses to run twice (existing tag, `ZZ` plates, `0955500` phones or September sheets).

## Customer portal note

Seed creates **CRM customer rows** (893) + vehicles + bookings for staff screens. It does **not** create `auth.users` for `*@sep2026.hakum.test`, so those people **cannot** sign into `/account`. Portal smoke uses the existing demo: `demo.customer@hakumautocare.com` / `HakumCustomer2026!`.

## What is seeded

| Area | Result in production |
|---|---|
| Bookings | 1,221 (completed 1,141 · cancelled 64 · no-show 16), 29 failed-QA redos, wash + multi-day detailing |
| Status history / crew | 4,766 queue events · 1,400 crew assignments (only on days the crew attended) |
| Sales | paid 1,276 · refunded 6 · voided 6 (cash / GCash / card, counter product sales, discounts with reasons) |
| Maintenance | 38 schedules linked to vehicles (installs enrolled +6 months). On 2026-10-04: 26 upcoming, 10 overdue, 6 notified, 8 reset by a paint-maintenance visit |
| Daily sheets | 60 (2 branches × 30 days) through the real RPCs: approved, returned → fixed → approved, reopened → corrected → approved, one still returned (Bacoor Sep 29), one still waiting (Batangas Sep 30). ASA reviewed 18, SA the rest |
| Drawer | over/short on Bacoor 5 · 14 · 23 and Batangas 9 · 19 · 26, each with a note |
| Overrides | Team Lead ₱800 day rate and detailer ₱700 floor, each with a reason |
| Bills | rent paid; electricity approved, unpaid, due 2026-10-05 |

Floor Board for Sep 1–30: net sales ₱1,618,627.00 — Bacoor ₱974,224.50 (expenses ₱315,904.51, profit ₱658,319.99),
Batangas ₱644,402.50 (expenses ₱222,376.83, profit ₱422,025.67). The verifier recomputes these from raw rows.

## Tags (how seed rows are found)

- Notes / descriptions contain `[seed:sep2026]`.
- Plates `ZZB####` (Bacoor) / `ZZT####` (Batangas); phones `0955500####`; emails `seedN@sep2026.hakum.test`.
- Customers have `notify_sms = false`; detailing queue numbers are 901+ so the live counter is untouched.
- Batangas seed staff: `ba.batangas@`, `crew1.batangas@`, `crew2.batangas@`, `detailer.batangas@seed.hakum.test`
  (password `HakumSeed2026!`, names end in "(Seed)"). The wipe removes them.

## Safety

- Rows are inserted in their final state, so the completion-SMS trigger (UPDATE of status) never fires: 0 `sms_events`.
- No push or SMS is sent. Daily sheets use the RPCs only; web push is sent by the app, not the database.
- Opening float rule: salaries are paid from drawer cash while ~45% of sales are GCash/card, so the runner raises the
  float when needed: `float = max(planFloat, ceil((50000 − expectedNoFloat − overShort) / 100000) × 100000)`
  and `counted = expected + float + overShort`.

## Logins for checking

| Role | Login |
|---|---|
| SA (BossMich) | `bossmich@hakumautocare.com` |
| ASA | `assistant@hakumautocare.com` |
| Bacoor Branch Admin | `admin@hakumautocare.com` |
| Bacoor Team Lead | `teamlead@hakumautocare.com` |
| Batangas Branch Admin | `ba.batangas@seed.hakum.test` |

Where to look: Floor Board (Timeline › Custom › Sep 1–30), Finance › Daily sheets / Sales / P&L with the September range,
POS › Daily sheet for 2026-09-29 (Returned) / 09-12 (Approved after reopen) / Batangas 09-30 (Waiting for approval),
Bookings › Maintenance.

## Role probe (statuses, overrides, approvals)

`supabase/tests/daily_flow_role_probe.sql` drives one Batangas car through the real lifecycle as each role inside a
transaction that ends in `ROLLBACK` (nothing persists, nothing is messaged). Last run 2026-10-04: 20/20 PASS —
TL assign crew / start / final check / failed QA / restart / send to payment; Bacoor TL and Bacoor BA blocked on a
Batangas car; crew cannot change status; BA override for payment → final check cancels the POS handoff; ASA and SA
overrides; TL cancel with reason; every move in `queue_events` with its actor; 0 SMS; BA cannot approve its own
Daily Sheet; ASA can.

`supabase/tests/rls_read_fingerprint.sql` hashes what every user can read in sales / sale lines / bookings / queue
events. Run it before and after any read-policy change; the fingerprint must not change.

## Bugs found while seeding (fixed in production)

1. **P0 — Team Lead final check failed for most staff.** `bookings.final_checked_by` / `sent_to_payment_by` referenced
   `customers`, so any staff without a customer row (TL Batangas, Site Admin, SA, ASA) hit a foreign-key error moving a
   car to Final check, and the send-to-payment RPC stamped NULL. Now reference `staff_profiles`
   (`20261004090000_queue_stamps_reference_staff.sql`).
2. **P1 — Floor Board 500 / slow dashboards.** Read policies on `sales`, `bookings` and `queue_events` ran role/branch
   helpers once per row (0.3–0.8 ms each): the ASA Floor Board's latest-events query took 4.2 s and returned 500 on
   mobile, a month of sales took 1.3–3 s. Helpers now run once per query with identical access (fingerprint unchanged
   for all 25 sampled users): events 140–190 ms, September sales 350–640 ms, bookings 220–280 ms
   (`20261004091000_queue_events_created_desc_index.sql`, `20261004092000_hot_read_policies_initplan.sql`).
