# 09 — Gaps & risks (do not soft-pedal)

## Critical / high

| # | Risk | Severity |
|---|------|----------|
| 1 | `cash_advance_auto_deduct` non-functional (status, staff_id, units) | **Critical** (honesty) |
| 2 | `pending_floor_optional` not enforced on confirm | **High** (honesty) |
| 3 | Package kinds collapsed to `adjustment` in RPC → My Pay mislabel | **High** |
| 4 | CA form unbound to `staff_profiles` | **High** (ops + deduct) |

## Medium

| # | Risk |
|---|------|
| 5 | Claimed `business_date` from UTC `occurred_at` slice vs Manila close date |
| 6 | Ceramic expenses filtered by `created_at` not sale day |
| 7 | Wash pool includes any present role (BA can share) |
| 8 | `payout_weekday` dead |
| 9 | Floor `loadProof` fetches packages then ignores them |
| 10 | Wrong-kind confirm (floor vs fixed) easy on one tab |

## Lower

| # | Risk |
|---|------|
| 11 | Global advisory lock serializes all branch confirms |
| 12 | ASA view sees full math without write (intentional, still sensitive) |
| 13 | Settings “SA only” copy vs `isAdmin` write |

## What is *not* a bug

- EoS does not pay crew (by design).
- BA cannot open Payroll register (by design).
- Dual floor/fixed tracks.
- Pending ₱ ≠ POS proof ₱.
- Manual confirm required (no nightly auto-pay).

## Architecture deepening candidates

1. **Strong** — ShopDaySettlement vs FloorPayWindow named module (pending + coverage locality).
2. **Strong** — CA pipeline: form staff_id + status contract + deduct units (or delete flag).
3. **Worth exploring** — Preserve package kinds through `run_payroll` / My Pay labels.
4. **Worth exploring** — Enforce or remove `pending_floor_optional`.
5. **Speculative** — Role filter on wash roster (crew/TL only).
