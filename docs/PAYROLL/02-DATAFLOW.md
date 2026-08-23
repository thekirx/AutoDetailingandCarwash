# 02 — Payroll dataflow (tables & RPC)

## Authoritative pay path

```text
buildPayrollPreview (client, pure)
  → buildRunPayrollPayload
  → RPC run_payroll
  → payroll_runs + payroll_run_lines + payroll_run_sales
  → expenses paid / inserted (adds only; deducts skip expense)
  → audit_logs payroll.run
```

Clients have **SELECT** on payroll tables. Confirms are **RPC-only** (SECURITY DEFINER). Advisory lock serializes confirms (`pg_advisory_xact_lock`).

## Tables

| Table | Role |
|-------|------|
| `payroll_runs` | Header: period, branch, frequency, `run_kind`, status, totals, notes |
| `payroll_run_lines` | Employee lines: kind, amount_minor ≥ 0, direction_key, staff |
| `payroll_run_sales` | Claimed sale ids (unique globally — one claim per sale) |
| `staff_pay_packages` | Fixed / hybrid monthly packages |
| `compensation_settings` | Singleton policy (pool %, ceramic, weights, flags) |
| `expenses` | Ceramic drafts consumed; paid payroll expense rows |
| `sales` / `sale_line_items` | Floor proof input |
| `staff_attendance` | Roster weights |
| `shift_close_reports` | Pending queue input only |
| `ops_form_submissions` | Cash advances |

## Line kinds (preview vs stored)

| Preview kind | Stored after RPC (typical) |
|--------------|----------------------------|
| `wash_pool` | `wash_pool` |
| `ceramic_crew` / `ceramic_detailer` | same |
| `package_fixed` / `package_hybrid` | Often collapsed to `adjustment` |
| `adjustment_add` / `adjustment_deduct` | `adjustment` + direction |

**Risk:** My Pay / history that key off `package*` prefixes miss posted fixed lines.

## Indexes (notable)

- `payroll_runs_floor_coverage_idx` — confirmed/paid floor by branch+period
- `shift_close_reports_pending_payroll_idx` — submitted/accepted/locked closes
- `payroll_run_sales_sale_uidx` — one claim per sale
- Period / branch / staff indexes on runs and lines

## RLS (summary)

- Runs/lines/sales: SA, ASA with `finance_view`, or employee on own lines
- Mutate packages: SA or ASA `finance_write`
- Writes of runs: via `run_payroll` only

## What Payroll does **not** write

- POS `sales` amounts
- `shift_close_reports` money (Finance reviews separately)
- Automatic daily cron pay (manual confirm only)
