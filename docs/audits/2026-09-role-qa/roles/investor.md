# Investor

- **Wave:** C
- **Demo:** `investor@hakumautocare.com`
- **Guide:** [docs/guides/roles/investor.md](../../../docs/guides/roles/investor.md)
- **Home:** `/operations/finance`
- **Shell:** command

## Allowed routes (must load)

`finance`, `reports`

## Denied routes (must wall / absent from nav)

Must-deny focus: `pos`, `people`, `queue`, `payroll`, `my-pay`

Code-denied sample: `console`, `dashboard`, `queue`, `queue-new`, `bookings`, `crew`, `attendance`, `kpi`, `my-tasks`, `pos`, `inventory`, `crm` …

## Nav / dock

Finance

Dock helper: Finance only

## Primary buttons / modals / filters

Finance tabs read

## Happy path

Finance hub

## Failure path

Any ops write surface denied

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/investor/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened — POS deep-link denied (`investor-deny.png`).
