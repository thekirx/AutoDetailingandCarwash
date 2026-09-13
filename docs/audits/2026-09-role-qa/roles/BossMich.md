# Super Admin (BossMich)

- **Wave:** C
- **Demo:** `bossmich@hakumautocare.com`
- **Guide:** [docs/guides/roles/super-admin-asa.md](../../../docs/guides/roles/super-admin-asa.md)
- **Home:** `/operations/console`
- **Shell:** command

## Allowed routes (must load)

`console`, `dashboard`, `queue`, `queue-new`, `bookings`, `crew`, `attendance`, `kpi`, `my-tasks`, `pos`, `inventory`, `crm`, `reviews`, `memberships`, `finance`, `payroll`, `planning`, `roadmap`, `history`, `notifications`, `people`, `branches`, `cars`, `content`, `audit`, `data-center`, `inquiries`, `settings`, `reports`

## Denied routes (must wall / absent from nav)

Must-deny focus: `my-pay`

Code-denied sample: `my-pay`

## Nav / dock

Console · Floor Board · Queue · Bookings · Attendance · Crew · KPI · POS · Inventory · CRM · Reviews · Memberships · Finance · Payroll · Planner · Ops Lab · History · Notifications · People · Branches · Cars · Content · Audit · Data Center · Inquiries · Settings

Dock helper: Command full nav

## Primary buttons / modals / filters

EoS accept, payroll confirm, people grants

## Happy path

Console → Finance shift-close tab

## Failure path

N/A (full access except my-pay)

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/BossMich/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened yet — update when found.
