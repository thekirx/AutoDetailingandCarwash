# Customer (portal)

- **Wave:** E
- **Demo:** `demo.customer@hakumautocare.com`
- **Guide:** [docs/guides/roles/customer.md](../../../docs/guides/roles/customer.md)
- **Home:** `/account`
- **Shell:** customer PWA

## Allowed routes (must load)

(portal `/account/*`)

## Denied routes (must wall / absent from nav)

Must-deny focus: `/operations/*`

Code-denied sample: `/operations/*`

## Nav / dock

Account · Book · Queue · Loyalty · More

Dock helper: Customer account nav

## Primary buttons / modals / filters

Book, queue, loyalty, more

## Happy path

Sign-in → /account

## Failure path

Bad credentials soft error

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: `e2e-evidence/role-qa/customer/` (when captured)
- Related: `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`
- Commands: `npm run e2e:ui-p0`, `npm run e2e:ui-money`, targeted login checks

## Bugs this wave

- None opened — sign-in → `/account`; ops wall (`customer-deny-ops.png`); public utils shot in `e2e-evidence/role-qa/`.
