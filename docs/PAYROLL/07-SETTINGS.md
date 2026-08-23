# 07 — Payroll settings (configurable vs hardcoded)

## Surfaces

| Surface | Path | What it edits |
|---------|------|----------------|
| Rules tab | `/operations/payroll?tab=rules` | Pool %, ceramic splits, payout frequency (+ weekday) |
| Payroll settings | `/operations/settings/payroll` | Attendance weights, pending optional, CA auto-deduct |
| Compensation row | `compensation_settings` id = 1 | Singleton — one source of truth |

## Actually configurable

- `wash_pool_pct`, ceramic shirt / card / crew / detailer percents
- `payout_frequency` (daily … custom)
- `payout_weekday` (stored; **unused** by period helper)
- `attendance_present_weight`, `attendance_late_weight`
- `pending_floor_optional` (UI only today)
- `cash_advance_auto_deduct` (broken end-to-end — see [06](./06-CASH-ADVANCES.md))

## Hardcoded (not “settings”)

- Wizard steps and run kinds
- RPC line-kind allowlist and package→adjustment collapse
- Sale claim uniqueness
- Role → route matrix
- Wash/ceramic eligibility heuristics
- `FIXED_SALARY_BOOKS_BRANCH = 'hq'`
- CA form fields / submission statuses
- Proration divisors

## Copy honesty

Payroll Settings page may say “Only Super Admin can edit” while `canWrite = isAdmin(profile)` (SA + ASA + BA). BA cannot reach the page; **ASA can write**. Prefer: “SA and ASA with finance access.”

Rules save uses `canRunPayroll` (finance_write) — tighter than the Settings page gate. Split brain exists.

## Verdict on “fully customizable payroll”

**Not met.** Real knobs exist for pool and ceramic; attendance weights are real; pending/CA flags are incomplete. Do not advertise full customization.
