# Payroll audit log

Append-only. Newest first.

---

## 2026-08-23 — Money contract continue (notify / CA / My Pay)

**Doc:** `docs/OPS/MONEY-CONTRACT.md`  
**Migrations (remote):** `shift_close_accept_notify_payroll`, `payroll_package_kinds_ca_repayment`, `pos_ca_repayment_kind`

### Shipped

- Finance accept → inbox via `review_shift_close` + web push via `/api/notify-shift-close`
- CA approve requires branch staff link → `payload.staff_id` (manual deduct honesty)
- `run_payroll` stores `package_fixed` / `package_hybrid`; My Pay labels Fixed salary
- Dead CA auto-deduct path removed from `buildPayrollPreview`
- Tests: `tests/shopDaySettlement.test.js` (+ existing `moneyContract.test.js`)

### Closed from prior open list

- Web push fan-out
- CA form → `staff_id` bind
- My Pay package kind labels through RPC

---

## 2026-08-23 — Money contract (questionnaire lock)

**Doc:** `docs/OPS/MONEY-CONTRACT.md`  
**Migration:** `20260823140000_shift_close_accept_notify_payroll.sql`

### Shipped

- `pending_floor_optional` default **false** + `floorConfirmBlockedByPendingCloses` hard gate
- Pending UI: close attested ₱ **and** POS proof ₱
- `cash_advance_auto_deduct` forced off (manual wizard only)
- Finance accept → `user_notifications` to SA / ASA finance_write
- Finance column renamed **Floor coverage**
- Tests: `tests/moneyContract.test.js`

### Still open (say continue)

- ~~Web push fan-out from notification insert~~ → closed in continue
- ~~CA form → `staff_id` bind~~ → closed in continue
- ~~My Pay package kind labels through RPC~~ → closed in continue

---

## 2026-08-22 — Principal Payroll deep audit (docs pack)

**Author:** Principal fullstack + backend review  
**Scope:** Dual tracks, engine, pending/EoS, CA, settings, My Pay, RPC/RLS honesty.

### Findings (strict)

- Floor pay from paid POS + attendance: **PASS**.
- Fixed packages: **PASS** (RPC kind collapse → My Pay label risk).
- EoS pays crew: **FAIL by design**.
- `pending_floor_optional` gate: **FAIL** (UI theater).
- CA approve → close: **PASS**.
- CA auto-deduct: **FAIL** (status / staff_id / units).
- Trust boundary RPC writes: **PASS**.

### Artifacts created

- `docs/PAYROLL/README.md`
- `docs/PAYROLL/00-VERDICT.md` … `10-FLOWCHARTS.md`
- Architecture HTML to OS `%TEMP%` (session)

### Recommended fix order (engineering)

1. Repair or remove `cash_advance_auto_deduct`.
2. Enforce or remove `pending_floor_optional`.
3. Preserve package kinds in `run_payroll` / fix My Pay labels.
4. Manila-safe `business_date` for claimed sales coverage.
5. Bind CA form to `staff_id`.

### Related POS pack

See `docs/POS/` for counter → close → proof contract.

---

## Template for next audit

```text
## YYYY-MM-DD — title
Scope:
Verdict changes vs prior:
Broken seams found:
Docs updated:
Owner decisions locked:
```
