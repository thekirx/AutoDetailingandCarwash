# Marketing

- **Wave:** D
- **Demo:** `marketing@hakumautocare.com`
- **Guide:** [docs/guides/roles/marketing.md](../../../docs/guides/roles/marketing.md)
- **Home:** `/operations/crm`
- **Shell:** floor

## Allowed routes (must load)

`bookings`, `attendance`, `crm`, `my-pay`, `planning`, `history`, `notifications`

## Denied routes (must wall / absent from nav)

Must-deny focus: `pos`, `finance`, `people`, `queue`

Code-denied sample: `console`, `dashboard`, `queue`, `queue-new`, `crew`, `kpi`, `my-tasks`, `pos`, `inventory`, `reviews`, `memberships`, `finance` …

## Nav / dock

CRM · Bookings · Planner · Notifications · History · My pay

Dock helper: getMarketingDock

## Primary buttons / modals / filters

CRM SMS, forms/QR

## Happy path

CRM home + planner/forms

## Failure path

POS denied

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/marketing/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened yet — update when found.
