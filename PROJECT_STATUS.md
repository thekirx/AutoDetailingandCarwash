# Project Status

**Last Updated:** 2026-09-07 (Asia/Manila)  
**Current Branch:** main  
**Current Commit:** `f8e4e0a` (+ local fix `e2e-sales-bookings` RBAC assertions)

## Executive Summary

**Soft-launch workflows are VERIFIED working** (fresh 2026-09-07 session).  
Payroll, POS contracts, attendance, TL queue/ops units, sales booking form + status pipeline, and money EoS→payroll path all **PASS**. Not 100% production-perfect: Vercel owner SMS IP/env still open; `salary_draft_extras` needs a manual BA EoS demo.

## Workflow readiness (fresh evidence)

| Workflow | Status | Evidence (this session) |
|---|---|---|
| Attendance | **WORKING** | `e2e-attendance` PASS |
| Payroll (RPC/RLS/static) | **WORKING** | `e2e:payroll` PASS |
| Payroll money path (submit→accept→claim) | **WORKING** | `e2e:shift-close-money` 13/13 PASS |
| POS (shell/provision/handoff RPC) | **WORKING** | `e2e-pos-part2` PASS |
| TL / queue daily ops | **WORKING** | `e2e-queue-part3` PASS + TL unit 19/19 |
| Sales bookings + form + statuses | **WORKING** | `e2e-sales-bookings` PASS (create→confirm→waiting→cancel; `for_payment` denied) |
| Ops cutover gates | **WORKING** | `e2e:cutover` PASS (WARN: salary_draft_extras) |
| Full browser TL→POS→pay | **PARTIAL** | Covered by UI money / P0 historically; not re-run this hour |
| Owner SMS on Vercel | **BLOCKED (ops)** | Local/office proven; Hakum Vercel team env/IP open |

## Recommended Next Action

Set `OWNER_SMS_PHONE` on the Hakum Vercel project + whitelist Vercel static BrandTxt IPs.

## Git State

```text
Ahead/local: scripts/e2e-sales-bookings.mjs (stale RBAC asserts fixed to match sales board pipeline)
Untracked noise: Brand Assets, tmp-*, skill dumps — leave alone
```
