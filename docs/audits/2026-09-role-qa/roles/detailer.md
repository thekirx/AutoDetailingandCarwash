# Detailer

- **Wave:** D
- **Demo:** `detailer@hakumautocare.com`
- **Guide:** [docs/guides/roles/detailer.md](../../../docs/guides/roles/detailer.md)
- **Home:** `/operations/bookings`
- **Shell:** floor

## Allowed routes (must load)

`bookings`, `attendance`, `my-tasks`, `my-pay`

## Denied routes (must wall / absent from nav)

Must-deny focus: `queue`, `dashboard`, `crew`, `kpi`, `pos`, `finance`

Code-denied sample: `console`, `dashboard`, `queue`, `queue-new`, `crew`, `kpi`, `pos`, `inventory`, `crm`, `reviews`, `memberships`, `finance` …

## Nav / dock

Bookings · Attendance · My Tasks · My pay

Dock helper: getDetailerDock

## Primary buttons / modals / filters

Stage/proof, attendance

## Happy path

Bookings detailing pipeline

## Failure path

Wash queue deep-link denied

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/detailer/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- **P0 fixed (Wave A):** wash queue deep-link denied — evidence `detailer-deny.png`.
