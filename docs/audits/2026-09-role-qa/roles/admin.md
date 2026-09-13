# Branch Admin

- **Wave:** B
- **Demo:** `admin@hakumautocare.com`
- **Guide:** [docs/guides/roles/branch-admin.md](../../../docs/guides/roles/branch-admin.md)
- **Home:** `/operations/pos`
- **Shell:** command

## Allowed routes (must load)

`dashboard`, `queue`, `attendance`, `pos`, `inventory`, `reviews`, `my-pay`, `planning`, `roadmap`, `history`, `audit`

## Denied routes (must wall / absent from nav)

Must-deny focus: `finance`, `crm`, `people`, `console`, `memberships`, `settings`

Code-denied sample: `console`, `queue-new`, `bookings`, `crew`, `kpi`, `my-tasks`, `crm`, `memberships`, `finance`, `payroll`, `notifications`, `people` …

## Nav / dock

Floor · Queue · Attendance · POS · Inventory · Reviews · Planner · Ops Lab · History · My pay · Audit

Dock helper: Command nav BA allowlist

## Primary buttons / modals / filters

POS checkout, EoS wizard open, inventory adjust

## Happy path

POS sale + inventory

## Failure path

Finance URL denied

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/admin/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened — finance deep-link → access-denied (`admin-deny.png`).
