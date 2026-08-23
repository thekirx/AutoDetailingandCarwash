# 06 — Cash advances (approve vs auto-deduct)

## What works

1. Staff submit ops form `cash_advance`.
2. SA/ASA with `finance_write` approve/decline on Payroll → Cash advance tab (`PayrollCashAdvancesPanel`).
3. Approve sets status **`resolved`** (decline → `archived`).
4. POS End of shift loads resolved CAs, remaps to `approved` for `buildBacoorDailyReport` — **close cash math feels the CA**.

## What does **not** work: auto-deduct

Setting: `compensation_settings.cash_advance_auto_deduct` (Payroll Settings checkbox).

When true, `buildPayrollPreview` is supposed to add deduct lines from `cashAdvances`. The load path is broken:

| Bug | Detail |
|-----|--------|
| Status filter | `loadProof` queries `status = 'approved'` — submissions use `resolved`, not `approved` |
| Staff link | CA form has **employee_name**, not `staff_id` — preview requires staff id → skips |
| Units | Form amount is pesos; preview treats payload as minor → ~100× under-deduct if fixed |

**Strict call:** Auto-deduct is a **settings lie** until all three are fixed. Manual adjustment on the wizard is the real path today.

## Product options (for later owner decision)

A) Fix status + staff_id + units and keep the flag.  
B) Remove the flag and document “manual deduct only.”  
C) Net CA only on close, never on payroll.

## Training line

“Approve CA on Payroll so the drawer close is right. To take it from someone’s pay, add a deduct line on the floor (or fixed) run until auto-deduct is repaired.”
