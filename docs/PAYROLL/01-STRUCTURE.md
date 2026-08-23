# 01 — Payroll structure (modules & files)

## Routes

| Path | Page | Gate |
|------|------|------|
| `/operations/payroll` | `PayrollPage.jsx` | `canAccessPayroll` |
| `/operations/my-pay` | `MyPayPage.jsx` | `canViewOwnPay` |
| `/operations/settings/payroll` | `PayrollSettingsPage.jsx` | settings route + `canAccessPayroll` |

## Register tabs (`PayrollPage`)

| Tab id | Job |
|--------|-----|
| `home` | Pending floor queue + recent runs |
| `run` | Dual wizard (floor / fixed) |
| `cash-advance` | Approve / decline CA submissions |
| `packages` | Fixed salary packages CRUD |
| `history` | Past runs (floor vs fixed badge) |
| `rules` | Pool % + ceramic + frequency |

## Who may open / write

| Role | Open register | Confirm / CA / Rules write | My Pay |
|------|---------------|----------------------------|--------|
| SA | Yes | Yes | No (redirect to Payroll) |
| ASA + `finance_view` | Yes | No | Yes |
| ASA + `finance_write` | Yes | Yes | Yes |
| BA / TL / Crew | No | No | Yes |

Symbols: `canAccessPayroll`, `canRunPayroll`, `canApproveCashAdvance`, `canViewOwnPay` in `permissions.js`.

## Module map

```text
PayrollPage.jsx
  ├─ payroll.js                 preview, payload, pending, coverage
  ├─ compensation.js            wash pool, ceramic, attendance weights, settings row
  ├─ PayrollCashAdvancesPanel   CA approve (ops_form_submissions)
  └─ rpc run_payroll            authoritative confirm

PayrollSettingsPage.jsx         attendance weights, pending flag, CA deduct flag
MyPayPage.jsx                   posted lines + today wash estimate
FinanceShiftCloseTab.jsx        Floor pay coverage label (reporting)
PosPage.jsx                     ceramic drafts + CA→close remapping
```

## Hottest files (audit order)

1. `src/lib/payroll.js`
2. `src/pages/PayrollPage.jsx`
3. Latest `run_payroll` migration (`20260821170000_payroll_run_kind_pending_floor.sql` and successors)
4. `src/lib/compensation.js`
5. `src/auth/permissions.js`
6. `src/pages/MyPayPage.jsx`
7. `src/components/PayrollCashAdvancesPanel.jsx`
8. `src/pages/settings/PayrollSettingsPage.jsx`
9. `src/pages/PosPage.jsx` (ceramic + CA close)
10. `src/pages/finance/FinanceShiftCloseTab.jsx`
11. `src/lib/opsForms.js` (CA payload shape)
12. `supabase/migrations/20260819100000_payroll_runs.sql` (schema / RLS origin)

## Tests that lock seams

| Test | Covers |
|------|--------|
| `tests/payrollPendingFloor.test.js` | Pending queue, claimed-day coverage |
| `tests/payrollSeam.test.js` / `payrollFullStack.test.js` | Preview / wiring |
| `tests/posPayrollSettings.test.js` | Settings normalize |
| `tests/opsMoneyAttendanceSeam.test.js` | Ceramic + wash pool |

## Architecture note

`PayrollPage` is a large orchestrator; depth lives in `payroll.js` + RPC. Deletion test: pending coverage and preview must stay in one module — splitting without a named `ShopDaySettlement` / `FloorPayWindow` seam recreates the “wrong ₱” confusion.
