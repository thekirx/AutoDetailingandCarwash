# Project Status

**Last Updated:** 2026-09-14 (Asia/Manila) — money-path leftovers verified + push  
**Current Branch:** main  
**Evidence stamp:** `npx eslint .` 0 · `npm test` **1239/1239** · `npm run build` 0 · [`docs/audits/2026-09-money-path/FINANCE-DEEP-AUDIT.md`](docs/audits/2026-09-money-path/FINANCE-DEEP-AUDIT.md)

## Executive Summary

Money triangle (POS → Finance → Payroll) audited with screenshots and leftover honesty fixes. Finance default window, retention, inverted ranges, vendors hang, and unposted-pay cues are closed. Soft-launch **READY_WITH_OPS_BLOCKERS** — Vercel SMS (BUG-002/003) still ops.

### Money-path campaign

| Wave | Status |
|------|--------|
| A Inventory + screenshots | **DONE** |
| B Honesty / find-bugs / design | **DONE** |
| C P0/P1 TDD fixes | **DONE** — BUG-021/022 |
| D Finance/Reports provenance | **DONE** |
| E POS/Payroll workflow polish | **DONE** |
| F Readiness close | **DONE** |
| Finance leftovers | **DONE** — BUG-035…041 |

## Recommended Next Action

1. BrandTxt IP + `OWNER_SMS_PHONE` on Vercel.  
2. Deferred POS: receipt/print, void/refund, owner add/remove payment methods (labels only).  
3. Deferred payroll: `run_payroll` recompute from POS; server pending-floor gate; brand pass.  
4. Deferred finance: brand pass (navy field). Receipt/void/payment-method CRUD stay deferred on POS.  
5. Optional: RPC-enforce POS payment allowlist (residual Medium).
