# System Audit

## Summary

| Field | Value |
|-------|-------|
| Audit date | 2026-09-13 (Asia/Manila) |
| Last eng pass | Role-matrix QA Waves A–F (`docs/audits/2026-09-role-qa/`) |
| Branch | `main` |
| Framework | Vite 6 + React 19 SPA · Supabase Auth/RLS/RPC · Vercel `api/*` → `server/*.mjs` |
| Build status | **PASS** — `npm run build` exit 0 |
| Unit suite | **PASS** — `npm test` **1188/1188** (`*.browser.test.js` → `npm run test:browser`) |
| Lint | **PASS** — `npm run lint` exit 0 |
| Role QA UI | **PASS** — `e2e:role-qa` 53/53 · `e2e:ui-p0` 9/9 · `e2e:ui-money` 5/5 |
| Readiness | **PASS** — `test:readiness` 14 passed / 0 failed (responsive skipped; BusyBee soft) |
| Soft-launch product | **READY_WITH_OPS_BLOCKERS** (SMS env) |
| Production-perfect | **NOT COMPLETE** — ops SMS + Wave 4–5 debt |

---

## Critical Issues

| Severity | Area | Issue | Status |
|----------|------|-------|--------|
| P1 (ops) | SMS | Vercel BrandTxt egress + `OWNER_SMS_PHONE` (BUG-002/003) | **Open (ops)** |
| P0 | Auth / IA | Detailer wash Queue deep-link via `QUEUE_VIEWER_ROLES` | **Closed** — removed; matrix test locks deny |
| P1 | DX | Landing puppeteer suites in default `npm test` | **Closed** — renamed `*.browser.test.js` |

---

## Role matrix campaign (2026-09)

| Item | Change |
|------|--------|
| Docs pack | `docs/audits/2026-09-role-qa/` MATRIX + per-role sheets |
| Evidence | `e2e-evidence/role-qa/` + ui-p0 / ui-money |
| Harness | `npm run e2e:role-qa` |
| Detailer IA | Bookings-only; Queue/Floor/Crew/KPI deep-links denied |

---

## Remaining Issues

| Priority | Item | Notes |
|----------|------|-------|
| P1 ops | BrandTxt IP + `OWNER_SMS_PHONE` on Vercel | Non-code |
| P2 | POS/payroll risks (drafts, payment methods, ceramic SKUs) | Deferred |
| P2 | Supabase leaked-password protection; counters RLS INFO | Deferred |
| P2 | `npm audit` prod vulns | Deferred |
| P3 | Branch select display names; PosPage split; full a11y | Deferred |

---

## Final Verification

| Check | Result |
|-------|--------|
| `npm run lint` | exit 0 |
| `npm test` | 1188 pass |
| `npm run build` | exit 0 |
| `npm run e2e:role-qa` | 53/53 |
| `npm run test:readiness` | PASS (SKIP_RESPONSIVE=1) |

**Verdict:** **READY_WITH_OPS_BLOCKERS** — code/role gates ready; production SMS ops config still required.
