# 05 — POS → Payroll connection (strict)

## The non-negotiable rule

**Floor payroll pays from paid POS sales + attendance (and ceramic expense keys / optional CA deduct).**  
**End of shift attestation ₱ does not calculate employee lines.**

Payroll UI copy already states this on Pending floor pay.

## Data path

```text
Paid sales (wash-eligible lines)
    + staff_attendance (present / late weights)
    + ceramic:* expense drafts (optional)
    + cash advances (if cash_advance_auto_deduct)
        → buildPayrollPreview
        → run_payroll (confirm)
        → payroll_runs + payroll_run_lines (+ payroll_run_sales claimed)

Accepted shift_close_reports
        → buildPendingFloorPayrollQueue (reminder only)
        → display total_sales_minor from submitted close (NOT pay math)
```

## Pending floor queue

| Field | Meaning |
|-------|---------|
| Days listed | Accepted/locked (and submitted) closes not yet “covered” |
| Coverage | Prefers claimed sale **business dates** on floor runs; else period fallback |
| ₱ shown | Close attestation sales — **may diverge** from POS proof after overrides |

`pending_floor_optional` exists on `compensation_settings` / Payroll Settings UI but is **not enforced** in `PayrollPage.jsx` today (dead policy flag).

## Fixed salary track

Separate `run_kind: 'fixed'` — packages / office — **not** bay POS proof. Do not mix with floor mental model.

## Cash advances

| Step | System |
|------|--------|
| Approve | Payroll (not POS) |
| Affect close | Approved CAs feed daily close expense / lists |
| Deduct on payroll | Only if `cash_advance_auto_deduct` true — then preview adds deduct lines |

## What Finance “Floor pay” column means

Reporting: whether a floor run already covers that close’s day (claimed/period). It does **not** mean “this close’s ₱ was paid out.”

## Strict judgment for Hakum

Connection is **architecturally sound** if training matches the contract.  
It is **confusing** if SA expects “accept close → money moves to crew automatically.” That is not implemented and should not be advertised without an explicit auto-run product decision.
