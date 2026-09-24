# System Audit

## Summary

| Field | Value |
|-------|-------|
| Audit date | **2026-09-24** (Asia/Manila) — principal completion + system audit |
| Branch | `main` (local FLOPS/docs/security fixes may be uncommitted vs `origin`) |
| Framework | Vite + React · Supabase Auth/RLS · PostgREST + `/api/*` |
| Build | **PASS** — `npm run build` exit 0 (this campaign) |
| Unit suite | **PASS** — **1269/1269** (`npm test`) |
| Lint | **PASS** — `npx eslint .` exit 0 |
| npm audit (prod) | **PASS** — **0 vulnerabilities** after `npm audit fix` (react-router → 7.18.4) |
| FLOPS shop-day | **PASS** — `e2e:lifecycle-flops` **23/23** · `e2e-evidence/lifecycle-flops/` |
| Money UI | **PASS** — prior campaign `e2e:money-path` 21/21 (artifact on disk) |
| Data integrity | **PASS** — `e2e:integrity` (this campaign) |
| Push wiring | **PASS** — `e2e-push-notifications.mjs` (this campaign) |
| POS handoff smoke | **PASS** — `smoke-pos-handoff.mjs` (no pending / exit 0) |
| Soft-launch | **READY_WITH_OPS_BLOCKERS** |
| Production messaging | **PARTIAL** — BrandTxt IP (customer reminders) + Auth SMTP may remain OPEN; **owner SMS N/A** |
| Jev browser agent | **Out of scope this pass** (keys optional; not product gate) |

## Critical Issues

| Severity | Area | Issue | Status |
|----------|------|-------|--------|
| P1 ops | SMS | BrandTxt / BusyBee egress IP (**customer** outbound) | **Open (ops)** BUG-002 — ErrorCode 11 on `180.191.244.237` |
| — | SMS | Owner daily SMS / `OWNER_SMS_PHONE` | **N/A** — disabled (`owner_sms_disabled`); push only |
| P1 ops | Auth | Auth SMTP proof | **Open (ops)** Gate 10.1 |
| Medium | Payroll | Same-day overlapping floor run refused | **By design** — documented; 2nd QA sale not auto-paid |
| Low | AST | graphify warns `SuperAdminFloorBoard.jsx` ~L344 | **Non-blocking** — Vite build parses; no product fail |
| High | Deps | react-router / undici advisories | **Closed** — `npm audit fix` → 0 vulns |
| Medium | DX | Stale source contracts (payroll `tab=rules`, “Detailing lives…”, inventory `?tab=services`) | **Closed** — tests/integrity aligned to intentional product |
| Medium | Lint | New Puppeteer scripts failed `no-undef` for browser globals | **Closed** — eslint browser+node allowlist |

## Functional Issues

| Page/Feature | Problem | Root Cause | Fix | Verified |
|--------------|---------|------------|-----|----------|
| Payroll settings link | Unit expected `?tab=rules` | Product links register `?tab=run` | Updated `opsShell.test.js` | 1269/1269 |
| Queue detailing copy | Unit expected old phrase | Copy is “Detailing jobs belong on Bookings” | Updated seam tests | 1269/1269 |
| Integrity services redirect | Expected `?tab=services` | App navigates to inventory hub | Updated `e2e-data-integrity.mjs` | integrity PASS |
| Shop-day lifecycle | Needed unified evidence | FLOPS harness | `e2e-lifecycle-flops` + docs pack | 23/23 |

## UI/UX Issues

| Page/Component | Issue | Design Rule | Fix | Verified |
|----------------|-------|-------------|-----|----------|
| Book page | Compact touch targets | Responsive CONDITIONAL | Accepted residual | Prior responsive CONDITIONAL |
| Archify map | Full shop-day roles | Showcase workflow | `docs/architecture/shop-day-flops.workflow.html` | deliver + visual-check pass |

## Validation Issues

| Form | Field | Problem | Fix |
|------|-------|---------|-----|
| — | — | No new form validation P0/P1 this pass | — |

## Responsive Issues

| Screen | Viewport | Issue | Fix |
|--------|----------|-------|-----|
| Public book | Mobile | Touch targets CONDITIONAL | Documented; not blocking soft-launch |

## Accessibility Issues

| Component | Problem | Fix |
|-----------|---------|-----|
| — | Not re-audited end-to-end this pass | Prior CONDITIONAL responsive; FLOPS RBAC denials verified |

## Backend/API Issues

| Endpoint/Service | Problem | Fix | Verified |
|------------------|---------|-----|----------|
| `review_shift_close` reopen | Note length UI vs DB | Migration char_length ≥ 3 | Prior FLOPS + unit |
| `run_payroll` overlap | Second same-day floor | Document honesty; no auto-void | FLOPS P1 note |
| Push subscribe/send | Unchecked in ultimate list | Ran live script | PASS this campaign |

## Missing Features / Incomplete Implementations

| Area | Missing Behavior | Priority |
|------|------------------|----------|
| Production SMS egress | Host whitelist | P1 ops |
| Owner SMS env on Vercel | Set + prove | P1 ops |
| Auth SMTP | Dashboard proof | P1 ops |
| CHEM-RECON prod habit | Weekly BA→SA | P2 ops |
| Observability (Sentry) | Optional accepted risk | P3 |
| Deferred POS | Receipt/print, void/refund CRUD | P2 product |
| Full `test:readiness` orch this hour | Not re-run (unit+FLOPS+integrity+push+build fresh instead) | P2 verify |

## Feature inventory (soft-launch bar)

| Feature | Frontend | Backend | Integration | Tests | Status |
|---------|----------|---------|-------------|-------|--------|
| Customer book / portal | Done | Done | FLOPS C1 | Unit + FLOPS | **Complete** (soft-launch) |
| Crew attendance | Done | Done | FLOPS A1 | Unit + live | **Complete** |
| TL wash queue | Done | Done | FLOPS W* | Unit + FLOPS | **Complete** |
| Sales detailing board | Done | Done | FLOPS B1 | FLOPS | **Complete** |
| BA POS + EoS | Done | Done | FLOPS W1/E1 | money-path + FLOPS | **Complete** |
| SA Finance accept + P&L | Done | Done | FLOPS F1 | SQL + UI | **Complete** |
| SA Floor payroll | Done | Done | FLOPS P1 | overlap caveat | **Complete** (caveat) |
| RBAC denials | Done | Done | FLOPS R1 | principalQaMatrix | **Complete** |
| Owner daily SMS prod | Done | Done | Ops | — | **BLOCKED** ops |
| Archify lifecycle diagram | Done | n/a | Artifact | validate/deliver | **Complete** |

## Tests Added or Updated

- `tests/opsShell.test.js` — payroll settings → `?tab=run`
- `tests/commandCategories.test.js` / `tests/leftoverUxSeam.test.js` — detailing copy
- `scripts/e2e-data-integrity.mjs` — services → inventory hub
- `eslint.config.js` — browser globals for FLOPS/probe scripts
- `scripts/e2e-shift-close-reopen.mjs` — unused `data` lint

## Final Verification

- [x] Production build passes
- [ ] Type check — N/A (JS project; no `tsc` script)
- [x] Lint passes
- [x] Automated tests pass (**1269/1269**)
- [x] Critical user flows tested (FLOPS 23/23 artifact + integrity + push)
- [x] No broken money-path redirects (integrity)
- [x] Permissions verified (FLOPS R1 + prior matrix)
- [x] Mobile/tablet/desktop — prior responsive CONDITIONAL; not re-run this hour
- [x] Known blockers documented (SMS/SMTP)
- [x] `PROJECT_STATUS.md` updated
- [x] Dependency vulns cleared (`npm audit` 0)

## Verdict

**Soft-launch shop-day code gate: MET** (with payroll overlap honesty note).  
**100% production ops gate: NOT MET** (BUG-002/003 + Auth SMTP).  
**Overall project completion for soft launch: READY_WITH_OPS_BLOCKERS.**

## Recommended Next Action

1. **Ops:** BrandTxt IP allowlist for **customer reminder** SMS + Auth SMTP proof if needed. Owner SMS is intentionally off.  
2. Commit/push FLOPS + security + doc tree when the owner asks (exclude Brand Assets / unrelated churn).  
3. Optional: re-run `npm run test:readiness` for a single orch stamp after push.
