# Epic: Daily Sheet close (was End of shift)

> **Superseded 2026-10-01.** End of shift wizard, Finance shift review, and pending-floor payroll unlock are retired.  
> Use [`docs/daily-sheet/README.md`](../daily-sheet/README.md) and [`shop-day-flow.md`](./shop-day-flow.md).

**Goal:** Branch Admin closes the day on one Daily Sheet; Super Admin / ASA approve so pay and expenses post once.

## US-CLOSE-01 · Branch Admin submits Daily Sheet

**As** branch admin  
**I want** to submit one Daily Sheet per branch per day  
**So that** sales, expenses, crew pay, and drawer cash are attested together  

**Acceptance**

- [x] One sheet per `(branch, business_date)` (`unique` on `daily_sheets`)
- [x] Money-in from paid POS only (not editable fiction)
- [x] Submit blocked until required sections complete
- [x] Web push to SA / ASA with `finance_view` (`sheet_submitted`)

**Test seam:** `tests/userStoriesCoverage.test.js` (US-CLOSE-01), `e2e:daily-sheet-money`, `tests/notificationRecipients.test.js`

---

## US-CLOSE-02 · Finance reviews Daily Sheet

**As** ASA or Super Admin  
**I want** to approve or return a submitted sheet  
**So that** books and crew pay stay correct  

**Acceptance**

- [x] Approve posts expense/salary lines once
- [x] Return with note; BA can resubmit
- [x] Reopen (SA) voids posted lines
- [x] Web push to submitting BA (`sheet_reviewed`)

**Test seam:** `e2e:daily-sheet-money`, `supabase/tests/daily_flow_role_probe.sql`, `tests/notificationRecipients.test.js`

---

## Historical (retired)

Former US-CLOSE stories that referenced `submit_shift_close` / `review_shift_close` / pending floor live only in archived Payroll/POS docs under `docs/PAYROLL/` and `docs/POS/`.
