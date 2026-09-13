# Assistant Super Admin

- **Wave:** C
- **Demo:** `assistant@hakumautocare.com`
- **Guide:** [docs/guides/roles/super-admin-asa.md](../../../docs/guides/roles/super-admin-asa.md)
- **Home:** `/operations/console`
- **Shell:** command

## Allowed routes (must load)

`console`, `dashboard`, `queue`, `queue-new`, `bookings`, `crew`, `attendance`, `kpi`, `my-tasks`, `pos`, `inventory`, `crm`, `reviews`, `memberships`, `finance`, `payroll`, `my-pay`, `planning`, `roadmap`, `history`, `notifications`, `people`, `branches`, `content`, `audit`, `inquiries`, `settings`, `reports`

## Denied routes (must wall / absent from nav)

Must-deny focus: `(grant-dependent)`

Code-denied sample: `cars`, `data-center`

## Nav / dock

Console · Floor Board · Queue · Bookings · Attendance · Crew · KPI · POS · Inventory · CRM · Reviews · Memberships · Finance · Payroll · My pay · Planner · Ops Lab · My Tasks · History · Notifications · People · Branches · Content · Audit · Inquiries · Settings

Dock helper: Command nav filtered by grants

## Primary buttons / modals / filters

Grant editor honesty

## Happy path

Console with default grants

## Failure path

Explicit false grant denies route

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/asa/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened yet — update when found.
