# 09 — Gaps & risks (do not soft-pedal)

## Critical / high

| # | Risk | Severity | Status |
|---|------|----------|--------|
| 1 | CA auto-deduct off; wizard deduct only | — | **Closed** (contract) |
| 2 | `pending_floor_optional = false` hard gate | — | **Closed** |
| 3 | Package kinds → My Pay labels | — | **Closed** (`payroll_package_kinds_ca_repayment`) |
| 4 | CA form unbound to `staff_profiles` | — | **Closed** — staff submit stamps `staff_id`; Payroll approve still requires link if missing |

## Medium

| # | Risk | Status |
|---|------|--------|
| 5 | Claimed `business_date` from UTC slice | **Closed** — `saleBusinessDate` (Asia/Manila) on pending coverage |
| 6 | Ceramic expenses filtered by `created_at` not sale | **Closed** — `filterCeramicExpensesForSales` keys off sale id |
| 7 | Wash pool bay crew only | By design (money contract E2) |
| 8 | `payout_weekday` unused in period math | **Closed** — UI labeled reminder-only |
| 9 | Floor `loadProof` fetched unused packages | **Closed** — packages load only for fixed runs |
| 10 | Wrong-kind confirm easy | **Closed** — kind switch resets wizard; confirm rejects mismatched preview |

## Lower

| # | Risk | Status |
|---|------|--------|
| 11 | Global advisory lock serializes confirms | Accepted (safety) |
| 12 | ASA view sees full math without write | Intentional |
| 13 | Settings “SA only” copy vs `isAdmin` write | Open / copy |
| 14 | `public_queue_*` SECURITY DEFINER views | **Intentional** — anon has no `bookings` SELECT; views expose only queue_number/status/pay_category. Do not flip to `security_invoker` without anon RLS. |

## What is *not* a bug

- EoS does not pay crew (by design).
- BA cannot open Payroll register (by design).
- Dual floor/fixed tracks.
- Pending ₱ ≠ POS proof ₱.
- Manual confirm required (no nightly auto-pay).

## Seam coverage (2026-08-26)

Clock/attendance · wash pool isolation · detailing assignee · CA deduct · EoS → Finance → pending floor → `run_payroll` · hard gate · POS handoff · wash-pool-only salary preview · package kinds · **Manila sale day** · **ceramic-by-sale** · **CA staff_id stamp**.

## Architecture deepening candidates

1. ShopDaySettlement vs FloorPayWindow named module.
2. Exact `expenses.description` fetch by sale-id chunks (scale) instead of `like` + soft `created_at` lower bound.
3. Separate floor vs fixed entry routes (deeper UX).
