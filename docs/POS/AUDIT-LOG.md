# POS audit log

Append-only. Newest first.

---

## 2026-08-23 — Money contract continue (ShopDaySettlement)

**Author:** Principal fullstack  
**Doc:** `docs/OPS/MONEY-CONTRACT.md`  
**Migrations (remote):** `shift_close_accept_notify_payroll`, `payroll_package_kinds_ca_repayment`, `pos_ca_repayment_kind`

### Shipped

- `src/lib/shopDaySettlement.js` — one seam for Bacoor report + floor preview + attendance
- POS loads today’s `staff_attendance` for salary preview on the daily report / EoS
- `expenses.expense_kind` allows `ca_repayment`; POS settings seeded
- Tests: `tests/shopDaySettlement.test.js`

### Closed from prior open list

- Attendance-aware POS salary preview
- ShopDaySettlement extraction

---

## 2026-08-23 — Money contract (questionnaire lock)

**Author:** Principal fullstack  
**Doc:** `docs/OPS/MONEY-CONTRACT.md`

### Shipped

- Report salary lines filled from wash-pool preview % (`applyFloorPreviewToBacoorReport`)
- EoS blocked when no sales/expenses/CA activity (`shiftCloseHasActivity`)
- Detailing: ceramic/manual expense keys remain the detailing pay path (documented)

### Still open (say continue)

- ~~POS report salary without live attendance roster~~ → closed in continue
- ~~Extract ShopDaySettlement~~ → closed in continue

---

## 2026-08-22 — POS audit fixes shipped (follow-up)

**Author:** Principal fullstack + UI pass  
**Scope:** Cart normalizer locality, ceramic-eligible detailing lines, EoS honesty UX, payment allowlist, pending_floor_optional UI, POS settings entry.

### Shipped

- `priceCartForMembership` → `buildCatalogCartLine` (package/detailing → service at pricing seam)
- `isCeramicCompensationLine` + expanded `detailingAmountMinor` (detailing tab / ceramic slugs; excludes PPF)
- Wash pool also skips detailing `catalog_kind` / ceramic-eligible lines
- EoS: “CA repaid to drawer” label + hints; approved CA list; draft expense count; attestation ≠ payroll copy
- Checkout validates payment method against `ops_pos_settings` list
- POS header link to `/operations/settings/pos` (settings-capable roles)
- Payroll pending copy + banner when `pending_floor_optional === false`
- Tests: `tests/posAuditFixes.test.js`

### Still not claimed

- Fully customizable POS (tabs/buckets/BA gate still hardcoded)
- BA walk-in bay/detailing catalog
- EoS ₱ as payroll calculator
- Server-side payment_method allowlist inside `complete_pos_sale` (client enforced)

---

## 2026-08-22 — Principal POS deep audit (docs pack)

**Author:** Principal fullstack review (agent)  
**Scope:** Completeness of payment (services/packages/detailing), walk-in inventory, settings customizability, End of shift data truth, payroll connection, role UX.

### Findings (strict)

- Queue/booking **final payment via Pay queue: PASS**.
- SA/ASA walk-in bay + detailing + merch: **PASS**.
- BA walk-in bay/detailing: **FAIL by design** (merch + Pay queue only).
- Package/detailing → RPC normalization: **PASS** (`normalizePosLineItemType`).
- End of shift baseline from paid sales: **PASS**; as payroll calculator: **FAIL by design**.
- Fully customizable settings: **FAIL** (thin DB-backed lists + field flags).
- BA day job operability: **MOSTLY PASS** with training.

### Artifacts created

- `docs/POS/README.md`
- `docs/POS/00-VERDICT.md` … `09-FLOWCHARTS.md`
- Architecture HTML review emitted to OS `%TEMP%`

### Follow-ups (need owner decisions — not silent code)

1. Confirm BA remains merch-only or expand walk-in services.
2. Whether to deepen Settings or stop claiming full customization.
3. Whether EoS draft expenses should count toward cash-left (currently counted; wizard now warns).
4. Whether `pending_floor_optional` must hard-block Run payroll (today: stronger copy only).

### Regression tests referenced

- `tests/posWorkflowSeam.test.js`
- `tests/posPayrollSettings.test.js`
- `tests/shiftClose.test.js`
- `tests/payrollPendingFloor.test.js`
- `tests/posAuditFixes.test.js`

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
