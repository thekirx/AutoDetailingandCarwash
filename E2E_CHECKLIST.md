# Hakum — Full E2E checklist (newrequest Parts 1–9)

**Purpose:** Prove every Part change fits live RBAC, schema, and data — now and after seed/deploy.  
**Runner:** `node scripts/e2e-newrequest.mjs` (orchestrates unit + part e2e + integrity + build).  
**Rule:** Do not mark a row `[x]` without exit code **0** from this session.

Last full run: **2026-07-26T11:36:10.435Z** (orchestrator exit 0)

---

## Gate 0 — Orchestrator

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 0.1 | Master suite green | `node scripts/e2e-newrequest.mjs` → exit 0 | [x] |
| 0.2 | Production build | `npm run build` → exit 0 | [x] |

---

## Part 1 — RBAC + nav + routing

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 1.1 | Permission helpers matrix | `node --test tests/permissions.test.js` | [x] |
| 1.2 | Marketing / no sales helpers | `node --test tests/permissions.marketingSales.test.js` | [x] |
| 1.3 | Demo chips exclude sales/cashier | `node --test tests/demoAccounts.test.js` | [x] |
| 1.4 | Live RBAC part1 (grants + multi-branch) | `node scripts/e2e-rbac-part1.mjs` | [x] |
| 1.5 | Full role × route matrix + logins | `node scripts/e2e-rbac-matrix.mjs` | [x] |
| 1.6 | DB: zero `sales`/`cashier` staff rows | integrity script | [x] |
| 1.7 | DB: `assistant_super_admin` + `permission_grants` | integrity script | [x] |
| 1.8 | DB: `staff_branch_assignments` usable | integrity script | [x] |
| 1.9 | Redirects: services/products/sms folded | integrity static App routes | [x] |

---

## Part 2 — POS shell (services + merch)

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 2.1 | POS sale payload unit | `node --test tests/posSale.test.js` | [x] |
| 2.2 | POS branch scope unit | `node --test tests/posBranchScope.test.js` | [x] |
| 2.3 | Live POS catalog / sizes / provision | `node scripts/e2e-pos-part2.mjs` | [x] |
| 2.4 | Nav has no standalone Services/Merch | part2 + matrix | [x] |

---

## Part 3 — Queue + Dashboard

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 3.1 | Queue logic unit (redo, timing, groups) | `node --test tests/queueLogic.test.js` | [x] |
| 3.2 | Live queue part3 | `node scripts/e2e-queue-part3.mjs` | [x] |
| 3.3 | DB: `redo` status + `visit_group_id` | integrity script | [x] |

---

## Part 4 — Crew + My Tasks

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 4.1 | Crew username unit | `node --test tests/crewUsername.test.js` | [x] |
| 4.2 | Live assignees + username col | `node scripts/e2e-part4-crew-tasks.mjs` | [x] |
| 4.3 | DB: `plan_card_assignees` RLS/read | integrity script | [x] |

---

## Part 5 — Finance

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 5.1 | Finance write grants unit | `node --test tests/financePart5.test.js` | [x] |
| 5.2 | Live categories + sales summary + quote preview | `node scripts/e2e-part5-finance.mjs` | [x] |
| 5.3 | DB: expense category kinds + indexes | integrity script | [x] |

---

## Part 6 — Planning settings / Forms / Events

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 6.1 | Planning helpers unit | `node --test tests/planningPart6.test.js` | [x] |
| 6.2 | Live presets / forms / events.slug | `node scripts/e2e-part6-planning.mjs` | [x] |
| 6.3 | DB: Part6 tables RLS enabled | integrity script | [x] |

---

## Part 7 — CRM + Bookings

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 7.1 | CRM insights helpers unit | `node --test tests/crmPart7.test.js` | [x] |
| 7.2 | Live CRM sales + bookings range | `node scripts/e2e-part7-crm-bookings.mjs` | [x] |

---

## Part 8 — KPI / Reports / Audit / Cars

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 8.1 | KPI/audit/catalog helpers unit | `node --test tests/part8.test.js` | [x] |
| 8.2 | Live catalog + audit + cycle cols | `node scripts/e2e-part8.mjs` | [x] |
| 8.3 | DB: `vehicle_catalog` write = super only | integrity script | [x] |

---

## Part 9 — Hardening + system readiness

| # | Check | Command / proof | Status |
|---|--------|-----------------|--------|
| 9.1 | Live readiness (roles + portal + public) | `node scripts/e2e-readiness.mjs` | [x] |
| 9.2 | Session unit | `node --test tests/session.test.js` | [x] |
| 9.3 | Audit security / P2 checks | `node scripts/check-audit-security.mjs` + `check-audit-p2.mjs` | [x] |
| 9.4 | Session check script | `node scripts/check-session.mjs` | [x] |
| 9.5 | Advisors: no anon branch RPC EXECUTE | `get_advisors` security — no anon create/update_branch; public INSERT WARNs intentional | [x] |
| 9.6 | Data integrity + future-proof schema | `node scripts/e2e-data-integrity.mjs` | [x] |

---

## Cross-cutting (smooth fit)

| # | Check | Proof | Status |
|---|--------|-------|--------|
| X.1 | All ops demo logins home correctly | readiness + matrix | [x] |
| X.2 | Marketing → CRM only; Staff → my-tasks | matrix | [x] |
| X.3 | Reports/cars Super(+ASA grant) only | matrix | [x] |
| X.4 | Public catalog SELECT (active) for booking | integrity | [x] |
| X.5 | No GraphQL / Xero deps introduced | package.json scan in integrity | [x] |

---

## How to re-verify after deploys

```bash
node scripts/e2e-newrequest.mjs
```

If any step fails: fix root cause, re-run **full** orchestrator (not only the failed file), then update Status column to `[x]` with the new timestamp in the runner footer.
