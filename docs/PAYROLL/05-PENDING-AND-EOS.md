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

**Timezone risk:** Client maps `sales.occurred_at` with `String(...).slice(0, 10)` (UTC prefix), while closes use local business_date — near midnight Manila can desync.

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
