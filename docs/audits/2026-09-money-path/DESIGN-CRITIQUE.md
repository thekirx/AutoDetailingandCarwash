# Design critique — Finance / POS / Payroll

Skills applied: design-dashboards Mode 1, web-interface-guidelines, ui-designer, design-taste (ops density).

## Verdict

Finance is already Xero-like in **tab IA** (`FINANCE_TABS`). Gaps were **proof provenance**, comparison emphasis, and POS cashier scan path — not a missing GL. POS Counter redesign (2026-08) is solid; polish = pending-first landing + draft honesty.

## What works

- Finance metric strip + period compare presets
- Payroll pending floor Close ₱ vs POS proof ₱
- My Pay confirmed vs estimate language
- POS shell tabs + pending badge + EoS wizard
- Tabular money / min-h-11 touch targets on POS redesign

## Severity-ranked issues

| Sev | Issue | Action |
|-----|-------|--------|
| High | Dashboard numbers without “paid POS” provenance | Provenance lines added (Wave D) |
| High | Cashiers land on Sell while Pay queue has work | `resolvePosLandingTab` (Wave E) |
| Medium | Settings “Customize” overclaims | Honesty copy (Wave C) |
| Medium | Expense drafts look like posted bills | Draft copy (Wave C) |
| Low | PosPage size / cognitive load | Deferred split |
| Low | Reports ops metrics mix bookings with P&L | Provenance note on Reports |

## Gestalt (Finance Dashboard)

- Scan path: totals → trend → branch/mix → recent — OK
- Figure/ground: metric strip is primary; charts secondary — OK
- Comparison: present when Compare on; strengthen with provenance always visible

## Chart / KPI

- Keep length/position charts (area/bar); no pie for P&L
- Income/Expenses/Net must stay simultaneous on one strip

## Web guidelines (sample)

- Prefer `…` in loading strings (POS already)
- Icon buttons need aria-label where icon-only
- URL already syncs finance/pos/payroll tabs

## Suggested next step after campaign

Run Dashboard Spec Grill only if owner wants new KPIs (budget vs actual) beyond paid POS.
