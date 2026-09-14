# Progress — money path 2026-09

## Prompt 1 — Wave A — 2026-09-13

- Scope: Scaffold docs, FE/BE maps, e2e:money-path harness, baseline verify.
- Docs: README, FE-MAP, BE-MAP, WORKFLOWS.
- Verdict: CONTINUE → Wave B

## Prompt 2 — Wave B — 2026-09-13

- Scope: Honesty + find-bugs + design critique.
- Docs: HONESTY.md, find-bugs.md, DESIGN-CRITIQUE.md.
- Verdict: CONTINUE → Wave C

## Prompt 3 — Wave C — 2026-09-13

- Fixes: payment allowlist fallback; settings honesty; expense draft copy; landing helper + tests.
- Verdict: CONTINUE → Wave D

## Prompt 4 — Wave D — 2026-09-13

- Finance Overview / P&L / Reports provenance lines (paid POS / finance_daily_pl).
- Verdict: CONTINUE → Wave E

## Prompt 5 — Wave E — 2026-09-13

- POS pending-first landing when handoffs wait; cashier draft expense honesty.
- Verdict: CONTINUE → Wave F

## Prompt 6 — Wave F — 2026-09-13

- Commands:
  - `npm run lint` exit 0
  - `npm test` 1194/1194
  - `npm run build` exit 0
  - `npm run e2e:money-path` 21/21
  - `SKIP_RESPONSIVE=1 npm run test:readiness` → 14 passed / 0 failed
- Docs: PROJECT_STATUS, SYSTEM_AUDIT, BUGS 021/022, README pointer.
- Remaining BLOCKED: BUG-002 / BUG-003 (Vercel SMS). Residual: RPC payment allowlist.
- Verdict: **DONE 100%** — **READY_WITH_OPS_BLOCKERS**

## Prompt 7 — POS leftovers — 2026-09-14

- P0: loyalty gate + catalog price trust (BUG-023/024)
- P1: dead expense_categories query, phone tabs, loading, settings ACL, tender ref, cart draft, EoS quiet day
- P2: pruned duplicate CTAs; navy order header
- Deferred: receipt/print, void/refund, add/remove payment methods
- Verify this session:
  - `npx eslint .` exit 0
  - `npm test` **1206/1206** (seam tests updated: no `expense_categories`, Pay queue tab copy)
  - `npm run build` exit 0
- Verdict: **DONE** — listed P0/P1 closed; P2 prune/brand shipped; remaining product items deferred above. Soft-launch still **READY_WITH_OPS_BLOCKERS** (BUG-002/003).

## Prompt 8 — Payroll deep analysis — 2026-09-14

- Analysis only. Evidence: `e2e-evidence/payroll-deep/` · report: `PAYROLL-DEEP-AUDIT.md`
- `DEV_PORT=5293 node scripts/_payroll-deep-shots.mjs` exit 0 (Boss desktop+phone, 339s)
- Commission: no tax; wash pool + ceramic + typed extras; merch can inflate wash base; ₱2,850 sales / ₱0 pool when attendance empty
- Strict scores: purpose 6 · commission honesty 4 · validation 4 · redundancy 5 · owner flex 4 · mobile 3 · brand 3

## Prompt 9 — Payroll leftovers — 2026-09-14

- P0: merch/product out of wash base; theoretical pool vs allocated; wizard amounts in pesos
- P1: validate every date range; clamp % 0–100; shirt in ₱; `salary_pct` copy; Settings write = `canRunPayroll`; load-error toasts; drop future junk closes; guide closed; Advances tab label + add/deduct Labels
- Deferred: RPC recompute of `run_payroll` amounts; server pending-floor gate; hybrid/custom salary math; merch commission type; brand pass
- Verify this session:
  - `npx eslint .` exit 0
  - `npm test` **1219/1219**
  - `npm run build` exit 0
- Verdict: **DONE** — listed P0/P1 closed. Soft-launch still **READY_WITH_OPS_BLOCKERS** (BUG-002/003).

## Prompt 10 — Finance + Reports deep analysis — 2026-09-14

- Analysis only. Evidence: `e2e-evidence/finance-deep/` (92 PNG) · report: `FINANCE-DEEP-AUDIT.md`
- `DEV_PORT=5295 node scripts/_finance-deep-shots.mjs` ASA exit 0 (164s); `WHO=boss` exit 0 (227s)
- Default month ₱0; last month ₱2,850 / 0 expenses / 0 shift closes; retention unwindowed; inverted custom range accepted; 11 tabs clip Reports
- Commission is not on Finance (Payroll Rules). Categories “Payroll / salary” is a P&L bucket.
- Strict scores: purpose 6 · commission honesty 4 · validation 3 · redundancy 4 · owner flex 5 · mobile 3 · brand 3

## Prompt 11 — Finance leftovers — 2026-09-14

- P0: default last 30 days + last-paid cue; retention windowed; inverted custom range rejected
- P1: 5 primary tabs + More; URL period/branch; guide closed; vendors hang; unposted-pay / no-close cues; category P&L copy; expense-report labels
- P2: Reports/Sales/Bills/P&L CSV-only; Dashboard keeps CSV/Excel/PDF; P&L duplicate Compare removed; quotes require amount > 0; Payroll handoff guide links to `/operations/payroll`
- Decided keep: Quotes/Corporate as More tabs (not merged); native HTML5 required on bill title; mixed tab title case
- Deferred: brand pass, Xero clone, tax, inventing EoS rows
- Verify this session:
  - `npx eslint .` exit 0
  - `npm test` **1239/1239**
  - `npm run build` exit 0
- Verdict: **DONE** — listed P0/P1 closed; listed P2 shipped or decided. Soft-launch still **READY_WITH_OPS_BLOCKERS** (BUG-002/003).

