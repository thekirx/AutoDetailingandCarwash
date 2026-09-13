# Staff / Crew

- **Wave:** B
- **Demo:** `staff1@hakumautocare.com`
- **Guide:** [docs/guides/roles/crew-staff.md](../../../docs/guides/roles/crew-staff.md)
- **Home:** `/operations/attendance`
- **Shell:** floor

## Allowed routes (must load)

`attendance`, `my-tasks`, `my-pay`, `planning`

## Denied routes (must wall / absent from nav)

Must-deny focus: `pos`, `finance`, `people`, `queue`, `payroll`

Code-denied sample: `console`, `dashboard`, `queue`, `queue-new`, `bookings`, `crew`, `kpi`, `pos`, `inventory`, `crm`, `reviews`, `memberships` …

## Nav / dock

Attendance · My Tasks · Planner · My pay

Dock helper: getStaffDock

## Primary buttons / modals / filters

Clock in/out, open task

## Happy path

Attendance clock + my-tasks

## Failure path

POS denied

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/staff/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened — POS deep-link → access-denied (`crew1-deny.png`).
