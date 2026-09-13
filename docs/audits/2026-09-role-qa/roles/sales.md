# Sales

- **Wave:** D
- **Demo:** `sales@hakumautocare.com`
- **Guide:** [docs/guides/roles/sales.md](../../../docs/guides/roles/sales.md)
- **Home:** `/operations/bookings`
- **Shell:** floor

## Allowed routes (must load)

`bookings`, `my-pay`, `history`

## Denied routes (must wall / absent from nav)

Must-deny focus: `queue`, `pos`, `finance`, `crm`

Code-denied sample: `console`, `dashboard`, `queue`, `queue-new`, `crew`, `attendance`, `kpi`, `my-tasks`, `pos`, `inventory`, `crm`, `reviews` …

## Nav / dock

Bookings · History · My pay

Dock helper: getSalesDock

## Primary buttons / modals / filters

Booking stage updates

## Happy path

Bookings board

## Failure path

Queue denied

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/sales/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened yet — update when found.
