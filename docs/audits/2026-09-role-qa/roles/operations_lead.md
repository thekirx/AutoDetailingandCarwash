# Operations Lead

- **Wave:** C
- **Demo:** `opslead@hakumautocare.com`
- **Guide:** [docs/guides/roles/operations-lead.md](../../../docs/guides/roles/operations-lead.md)
- **Home:** `/operations/roadmap`
- **Shell:** command

## Allowed routes (must load)

`dashboard`, `queue`, `queue-new`, `crew`, `attendance`, `kpi`, `my-tasks`, `pos`, `reviews`, `finance`, `my-pay`, `planning`, `roadmap`, `history`, `audit`, `settings`

## Denied routes (must wall / absent from nav)

Must-deny focus: `people`, `branches`, `payroll`

Code-denied sample: `console`, `bookings`, `inventory`, `crm`, `memberships`, `payroll`, `notifications`, `people`, `branches`, `cars`, `content`, `data-center` …

## Nav / dock

Floor · Queue · Crew · KPI · POS · Reviews · Planner · Ops Lab · History · My pay · Finance · Audit

Dock helper: Command OL set

## Primary buttons / modals / filters

Ops Lab items, queue override

## Happy path

Roadmap / Floor / POS network view

## Failure path

People denied

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/operations_lead/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened — people deep-link denied (`opslead-deny.png`).
