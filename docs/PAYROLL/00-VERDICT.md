# 00 — Strict Payroll verdict

**Date:** 2026-08-22  
**Question:** Is Payroll complete, correct, and honest for Hakum dual-track pay (crew/TL floor + fixed packages), pending closes, cash advances, and My Pay?

## Scorecard (strict)

| Claim | Verdict | Notes |
|-------|---------|-------|
| Floor pay from **paid POS + attendance** | **PASS** | `buildPayrollPreview` → `run_payroll` |
| Fixed salary from packages | **PASS** (with labeling caveat) | Proration works; RPC stores kind as `adjustment` |
| Dual floor / fixed tracks | **PASS** | `run_kind` + separate wizards |
| End of shift ₱ pays crew | **FAIL (by design)** | Attestation / pending reminder only |
| Pending floor queue useful | **PASS** | Coverage prefers claimed sale days |
| `pending_floor_optional` gates confirm | **FAIL** | Banner/copy only — not enforced |
| Cash advance approve on Payroll | **PASS** | Status `resolved` |
| CA auto-deduct on floor preview | **FAIL** | Wrong status filter, no `staff_id`, unit mismatch |
| My Pay shows posted lines | **PASS** | Confirmed/paid lines |
| My Pay estimate = full accrual | **FAIL (by design)** | Today wash-pool only |
| Settings fully control engine | **FAIL** | Thin policy surface; some dead knobs |
| BA can run Payroll | **FAIL (by design)** | SA / ASA finance only |
| Trust boundary (RPC writes) | **PASS** | Client SELECT; `run_payroll` DEFINER |

## One-paragraph honest summary

Hakum Payroll is a **real dual-track register**: floor pay recomputes from **paid POS sales + attendance (+ ceramic expense keys)**; fixed pay prorates **monthly packages**. End of shift and Finance accept do **not** move money to employees — they only stack an optional pending reminder. Several Settings flags (`pending_floor_optional`, `cash_advance_auto_deduct`) and `payout_weekday` are **policy theater or dead**. Cash advance **approval** works for daily close; **auto-deduct on payroll does not work** end-to-end. Calling the surface “settings-gated pending” or “CA auto-nets payroll” is **false advertising**.

## Recommendation

Keep the POS-proof contract. Fix CA auto-deduct **or** remove the setting. Either enforce `pending_floor_optional` on confirm **or** stop saying “required.” Preserve package kinds through RPC or fix My Pay labels. Document training: accept close ≠ paid crew.
