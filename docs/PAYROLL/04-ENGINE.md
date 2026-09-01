# 04 — Pay engine (wash pool, attendance, ceramic, packages)

## Wash pool

**Symbol:** `washPoolAmountMinor` → `splitWashPool` in `compensation.js`.

1. Sum line totals that are **not** detailing / ceramic-eligible.
2. Pool = sum × `wash_pool_pct` (default 35%).
3. Split across roster for that branch+day with `attendanceWeight` > 0.

**Roster honesty:** Wash pool is **bay crew only**. `splitWashPool` drops `detailer`, `team_lead`, `admin`, `super_admin`, `investor`, `sales`, `marketing`. Assigned detailing commission uses `forWashPool: false` so the detailer is not dropped.

## Attendance weights

| Status | Default weight | Configurable |
|--------|----------------|--------------|
| present | 1 | `attendance_present_weight` |
| late | 0.7 | `attendance_late_weight` |
| else | 0 | — |

Loaded from `compensation_settings` via `normalizeCompensationSettings`. Used when `splitWashPool(..., { rules })` is passed from preview.

## Ceramic / detailing drafts

1. POS checkout may insert expenses `ceramic:{saleId}:crew|detailer` (draft).
2. Floor preview parses keys; splits amount onto day’s roster (detailer role preferred for detailer side).
3. Confirm pays those drafts or posts payroll expenses.

**Seams:** Ceramic expenses filtered by expense `created_at` in load — can disagree with sale `occurred_at`. Empty detailer roster → missing-assignee line.

## Fixed package proration

**Symbol:** `prorateMonthlyPackageMinor(monthly, frequency, period)`.

| Frequency | Share of monthly |
|-----------|------------------|
| monthly | 100% |
| semimonthly | ½ |
| biweekly | 12/26 |
| weekly | 12/52 |
| daily | /30 |
| custom | day-fraction of period |

## Confirm gates (client)

`payrollBlocksConfirm` — assignees present, amounts sane, net > 0. **Does not** require End of shift accepted or pending cleared.

## Dead / weak knobs

| Knob | Status |
|------|--------|
| `payout_weekday` | Editable on Rules; **not** used by `payrollPeriodRange` |
| Hybrid package kind | Label only — same proration as fixed |
