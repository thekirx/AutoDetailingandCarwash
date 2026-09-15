# Scripts E2e Sales Bookings Mjs

> 14 nodes · cohesion 0.12

## Key Concepts

- **submit_shift_close** (4 connections) — `docs/POS/01-STRUCTURE.md`
- **buildBacoorDailyReport** (4 connections) — `docs/POS/04-END-OF-SHIFT.md`
- **ShopDaySettlement** (3 connections) — `docs/PAYROLL/01-STRUCTURE.md`
- **CA Approve Sets Status Resolved** (2 connections) — `docs/PAYROLL/06-CASH-ADVANCES.md`
- **EoS Remaps Resolved CA to Approved** (2 connections) — `docs/PAYROLL/06-CASH-ADVANCES.md`
- **review_shift_close Payroll Inbox Notify** (2 connections) — `docs/PAYROLL/AUDIT-LOG.md`
- **review_shift_close** (2 connections) — `docs/POS/01-STRUCTURE.md`
- **ShiftCloseWizard** (2 connections) — `docs/POS/01-STRUCTURE.md`
- **Shop-Day Settlement Attestation** (2 connections) — `docs/POS/04-END-OF-SHIFT.md`
- **FloorPayWindow** (1 connections) — `docs/PAYROLL/01-STRUCTURE.md`
- **cash_advance Ops Form** (1 connections) — `docs/PAYROLL/06-CASH-ADVANCES.md`
- **shift_close_accept_notify_payroll** (1 connections) — `docs/PAYROLL/AUDIT-LOG.md`
- **ca_collected_minor Double-Count Hazard** (1 connections) — `docs/POS/04-END-OF-SHIFT.md`
- **pos_baseline vs submitted Attestation** (1 connections) — `docs/POS/04-END-OF-SHIFT.md`

## Relationships

- [Scripts Set Sms Shop Gate Mjs](Scripts_Set_Sms_Shop_Gate_Mjs.md) (1 shared connections)
- [Src Lib Compensation](Src_Lib_Compensation.md) (1 shared connections)

## Source Files

- `docs/PAYROLL/01-STRUCTURE.md`
- `docs/PAYROLL/06-CASH-ADVANCES.md`
- `docs/PAYROLL/AUDIT-LOG.md`
- `docs/POS/01-STRUCTURE.md`
- `docs/POS/04-END-OF-SHIFT.md`

## Audit Trail

- EXTRACTED: 12 (80%)
- INFERRED: 3 (20%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*