# 05 — Pending floor & End of shift

## The non-negotiable rule

**End of shift attestation ₱ does not calculate employee lines.**  
**Floor pay uses paid POS proof + attendance.**

Pending queue is a **reminder** of shop days Finance has (or is) reviewing that still need a floor run.

## Pending queue

**Symbol:** `buildPendingFloorPayrollQueue({ closes, runs })`.

| Input | Meaning |
|-------|---------|
| Closes | `shift_close_reports` in `submitted` / `accepted` / `locked` |
| Covered? | `floorPayrollCoversDay` |
| Display ₱ | `submitted.total_sales_minor` / legacy `square_sales_minor` — **attested**, may diverge from POS after overrides |

## Coverage

**Symbol:** `floorPayrollCoversDay`.

1. Run must be floor + `confirmed`/`paid`.
2. If `payroll_run_sales` present → day covered only if a claimed sale’s `business_date` matches (and branch).
3. Else fallback: day inside `period_start`…`period_end`.

**Shop day:** `saleBusinessDate` maps a sale to the Asia/Manila calendar date. Do not take a UTC `.slice(0, 10)` of `occurred_at`.

## `pending_floor_optional`

| Layer | Behavior |
|-------|----------|
| DB / Settings UI | Boolean on `compensation_settings` |
| Payroll home | Stronger copy + banner when `false` |
| `confirmRun` | Calls `floorConfirmBlockedByPendingCloses`. When `pending_floor_optional === false`, submitted or missing accepted close **blocks** floor confirm. |

## Finance “Floor pay” column

Reporting only via `shiftClosePayrollCoverage` — not a ledger.

## Correct ops story

1. BA submits End of shift.
2. SA/ASA accepts in Finance.
3. Day appears on Payroll → Pending (optional or “should run” copy).
4. SA runs Floor for that window from POS proof.
5. Confirm posts lines; claimed sales clear coverage.
6. Super Admin may **reopen** an accepted close (note required). Status returns to `rejected` so BA can submit a corrected drawer. A locked close stays locked. A confirmed payroll run is not voided.
