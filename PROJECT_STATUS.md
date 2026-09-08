# Project Status

**Last Updated:** 2026-09-08 (Asia/Manila) — audit plan Waves 0–3 executed  
**Current Branch:** main  
**Evidence stamp:** `npm test` **1193/1193** · build exit 0 · event geofence migration applied · see [`docs/SYSTEM_AUDIT.md`](docs/SYSTEM_AUDIT.md)

## Executive Summary

Wave **2 eng fixes are DONE** (event registration API geofence, waitlist/legal honesty, broadcast `skipped`, unit harness). Wave **1 production SMS remains BLOCKED (ops)** — this environment has no Vercel team credentials to set env/IPs. Wave **4–5** (POS debt, npm audit, polish) deferred as scheduled follow-ups.

### Progress vs plan

| Wave | Status |
|------|--------|
| 0 Release hygiene | **DONE** — commit `fadd27d` (noise left untracked) |
| 1 Ops SMS | **BLOCKED** — BrandTxt IP + `OWNER_SMS_PHONE` need Hakum Vercel access |
| 2 Eng P1/P2 | **DONE** — BUG-015…018 closed |
| 3 Confidence | **PARTIAL** — units+build PASS; lint dirty; full readiness orchestrator not re-run |
| 4–5 Debt/polish | **DEFERRED** — documented in SYSTEM_AUDIT |

## Workflow readiness

| Workflow | Status | Evidence |
|---|---|---|
| Unit suite | **WORKING** | `npm test` 1193/1193 (browser tests: `npm run test:browser` + preview) |
| Production build | **WORKING** | exit 0 |
| Event registration | **WORKING** | API + migration; units green |
| Forms / SMS / CRM / sign-in | **WORKING** *local/QA* | Prior campaign + this tree |
| Owner SMS on Vercel | **BLOCKED (ops)** | BUG-002 / BUG-003 |

## Recommended Next Action

1. Set BrandTxt whitelist + `OWNER_SMS_PHONE` on Hakum Vercel (Wave 1).  
2. Before cutover: `npm run test:readiness`.  
3. Schedule Wave 4 POS/security debt.
