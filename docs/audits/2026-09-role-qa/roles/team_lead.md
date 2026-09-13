# Team Lead

- **Wave:** B
- **Demo:** `teamlead@hakumautocare.com`
- **Guide:** [docs/guides/roles/team-lead.md](../../../docs/guides/roles/team-lead.md)
- **Home:** `/operations/queue`
- **Shell:** floor

## Allowed routes (must load)

`dashboard`, `queue`, `queue-new`, `crew`, `attendance`, `kpi`, `my-tasks`, `my-pay`, `planning`, `history`

## Denied routes (must wall / absent from nav)

Must-deny focus: `pos`, `finance`, `payroll`, `people`, `console`

Code-denied sample: `console`, `bookings`, `pos`, `inventory`, `crm`, `reviews`, `memberships`, `finance`, `payroll`, `roadmap`, `notifications`, `people` …

## Nav / dock

Floor · Queue · Attendance · Crew · KPI · My pay · Planner · My Tasks · History

Dock helper: getTeamLeadDock

## Primary buttons / modals / filters

New ticket, lane advance, attendance exception

## Happy path

Queue → advance lane / New ticket

## Failure path

Deep-link /operations/pos → access-denied

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/team_lead/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened — TL POS / BA finance / Staff POS denies verified in `e2e-evidence/role-qa/` (`tl-deny`, `admin-deny`, `crew1-deny`).
- Related packs: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/` (TL POS denied).
