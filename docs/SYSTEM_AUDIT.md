# System Audit

## Summary

| Field | Value |
|-------|-------|
| Audit date | 2026-09-13 (Asia/Manila) |
| Last eng pass | 2026-09-14 money-path leftovers verified (`docs/audits/2026-09-money-path/FINANCE-DEEP-AUDIT.md`) |
| Branch | `main` |
| Build | **PASS** — `npm run build` exit 0 (2026-09-14) |
| Unit suite | **PASS** — **1239/1239** |
| Lint | **PASS** — `npx eslint .` exit 0 |
| Money UI | **PASS** — `e2e:money-path` 21/21 · `e2e:ui-money` 5/5 |
| Readiness | **PASS** — 14 passed (SKIP_RESPONSIVE) |
| Soft-launch | **READY_WITH_OPS_BLOCKERS** (SMS env) |

## Critical Issues

| Severity | Area | Issue | Status |
|----------|------|-------|--------|
| P1 ops | SMS | BrandTxt + OWNER_SMS_PHONE | **Open (ops)** |
| High | POS | Empty payment allowlist | **Closed** BUG-021 |
| Medium | POS honesty | Draft expense / settings copy | **Closed** BUG-022 |
| Medium | Backend | RPC payment_method not settings-bound | **Open** (UI hardened) |
| Critical | POS | Loyalty giveaway / client prices | **Closed** BUG-023/024 |
| High | POS UI | Phone Sell tab clipped | **Closed** BUG-026 |
| High | Payroll | Merch in wash base / silent ₱0 pool / centavo editors | **Closed** BUG-028/029/030 |
| High | Finance | Default month ₱0 / Reports mix windows | **Closed** BUG-035/036 |

## Money-path changes

- Audit pack + deep screenshots
- `resolvePosLandingTab` — Pay queue first when pending
- Finance Overview / P&L / Reports provenance (`finance_daily_pl` / paid POS)
- Counter options honesty; expense draft labels
- 2026-09-14: loyalty redemption gate, catalog price trust, GCash/card ref, draft cart, BA settings ACL, phone tab clip, loading copy, EoS quiet-day close
- 2026-09-14: payroll merch-out-of-pool, theoretical vs allocated, pesos editors, range/% clamp, Settings ACL, honest `salary_pct`
- 2026-09-14: finance last-30 default + last-paid cue, retention window, inverted range gate, 5+More tabs, URL filters, vendors hang, unposted-pay cue, CSV-only ledgers, quote > 0, Payroll guide link

## Final Verification

| Check | Result |
|-------|--------|
| lint / test / build | 0 / **1239/1239** / 0 (2026-09-14 this session) |
| e2e:money-path | 21/21 |
| test:readiness | PASS |

**Verdict:** **READY_WITH_OPS_BLOCKERS**
