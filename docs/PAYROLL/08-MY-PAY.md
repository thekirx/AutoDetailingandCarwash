# 08 — My Pay

## Who sees it

Any role with `canViewOwnPay` — **not** SA (redirected to Payroll), **not** Investor.

## Cards (honest)

| Card | Source | Trust |
|------|--------|-------|
| Confirmed today / month | Own `payroll_run_lines` on confirmed/paid runs | **Posted** |
| Latest confirmed | Net of adds/deducts on latest run | **Posted** |
| Estimate | Today-only floor wash-pool preview for self | **Not money** |

Estimate excludes ceramic, packages, multi-day pending, and claimed-sale exclusion — copy should stay “estimate,” never “owed.”

## Labeling bug

RPC often stores package lines as `kind = 'adjustment'`. UI that detects Fixed via `kind.startsWith('package')` **misses** posted package pay. Prefer `source_key` (`package:…`) or fix RPC to preserve kinds.

## Training line

“My Pay shows what was confirmed. The estimate is today’s wash share only — ask SA about pending days or salary packages.”
