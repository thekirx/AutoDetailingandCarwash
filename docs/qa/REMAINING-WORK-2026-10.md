# Remaining work — principal PM audit (2026-10-05)

Honest, strict status after September seed + Daily Sheet cutover + three production fixes (BUG-046/047/048).  
Canonical product status: [`PROJECT_STATUS.md`](../../PROJECT_STATUS.md) · Audit table: [`SYSTEM_AUDIT.md`](../SYSTEM_AUDIT.md).

**Verdict:** Soft-launch **shop-day code** is ready with ops blockers. **Documentation and several role/story deep checks are not.** Continue — do not declare “fully done.”

### Future-branch / RBAC / future-users (2026-10-05)

| Item | Status |
|------|--------|
| Dasma URL slug `dasmarinas` (was random `aud-xmyz95`) | **Fixed in prod** — 10 bookings remapped; old slug archived |
| 27+ CRUD-test / probe branches cluttering pickers | **Archived in prod** |
| Hire onto coming-soon branches | **Fixed** — `isStaffAssignableBranch` in provision + update |
| Detailer / video editor branch picker + validation | **Fixed** — People UI + `EDITABLE_ROLES` / `BRANCH_REQUIRED_ROLES` |
| RBAC scope for a new city (any slug) | **Proven** — `tests/futureBranchReady.test.js` |
| Opening day flip (coming_soon → active) | **Ops step** — Branches → set Active; no code deploy required |
| Staff for Dasma before open | **Ready** — hire against `dasmarinas` now |

---

## Fresh verify (this session, 2026-10-05)

| Check | Command | Result |
|-------|---------|--------|
| Unit | `npm test` | **1465/1465**, exit 0 |
| Lint | `npx eslint .` | exit **0** |
| Build | `npm run build` | exit **0** |
| BUG-048 live | GET production `/api/public-inquiry` → **405**; `/api/data-center` → **401** | **PASS** (was 404) |
| Seed still present | SQL: 893 customers, 1221 bookings, 60 Sep sheets | Present (wipe before go-live = owner call) |
| Staff push | SQL: **0** staff push subscriptions (3 demo-customer only) | Soft-launch notify gap |
| Google review URLs | SQL: **0** branches with `https://` review link | Thumbs→Google not usable yet |

Prior-session evidence (not re-run this hour): nav-walk 84/84, role-qa 52/52, September verify 23/23, shots 22/22, role probe 20/20, daily-sheet-money 38/38, ui-money 5/5, ui-p0 9/9, integrity PASS. Treat as **stale until re-run** if code changes again.

---

## Progress that is real (code + data)

| Slice | Evidence | Honesty |
|-------|----------|---------|
| Daily Sheet money path | `e2e:daily-sheet-money` 38/38; guide [`daily-sheet/README.md`](../daily-sheet/README.md); Archify daily-sheet workflow/lifecycle | **Proven** |
| September test month | Seed + wipe + verify 23/23 + shots 22/22 | **Proven** (ops CRM data; **no** customer portal auth for seed people) |
| TL / BA / ASA / SA queue + sheet approvals | `daily_flow_role_probe.sql` 20/20 rollback | **Proven** at RPC/RLS |
| Floor Board / POS Today money depth | Unit + ops-pages shots 39/39 | **Proven** for SA/ASA/BA views |
| BUG-046 TL final-check FK | Prod migration + probe | **Closed** |
| BUG-047 hot RLS | Prod migration + fingerprint | **Closed** |
| BUG-048 gateway 404 | Deployed; live 405/401 | **Closed** |

---

## Not checked / not re-run (strict)

| Area | Why it matters | Status |
|------|----------------|--------|
| `e2e:lifecycle-flops` | Full shop-day click path (customer book → pay → close) | **NOT RE-RUN** — still drives **old** EoS/Payroll RPCs; needs rewrite for Daily Sheet |
| Real-device push audit | SA/ASA get sheet submit/approve alerts | **NOT RE-RUN**; **0 staff** devices opted in |
| Customer portal deep stories | Book, loyalty, queue, reviews, account for real customer | Smoke/role home only; **seed customers cannot log in** (0 auth users) |
| Marketing / Sales / Video / Investor deep CRUD | Persona epics claim coverage | Nav-walk + role-qa allow/deny only — **not** full story acceptance |
| People admin lifecycle | Hire/edit/deactivate staff | No fresh mutating e2e this campaign |
| Inventory / CRM expense categories deep | Catalog + stock mutations | Partial (one CRM category fix earlier); not full epic re-acceptance |
| Planner / My Tasks / Content / KPI / History | Remaining-ops epic | Nav load only |
| Multi-branch same-day live BA+TL | QA epic | September is historical seed; live same-day FLOPS gap |
| `e2e:responsive` full matrix | Mobile a11y/layout | Not re-matrixed this campaign |
| Full a11y audit | WCAG | Not end-to-end re-audited |
| BrandTxt SMS live | Customer status SMS | **BLOCKED** ErrorCode 11 |
| Auth SMTP Gate 10.1 | Password reset / invites | **Open** (ops) |
| Vercel Static IPs | Reliable SMS egress | **Open** (ops) |
| Xero-parity P&L (COGS, aged payables, VAT, bank recon) | Owner finance ambition | **Deferred by choice** (documented gaps) |

---

## Documentation debt (must continue)

Canonical Daily Sheet truth exists (`docs/daily-sheet/`, Archify). Many older docs still teach End of shift → Finance accept → Floor payroll.

| Artifact | Problem | Priority |
|----------|---------|----------|
| [`user-stories/README.md`](../user-stories/README.md) | Sprint night still “EoS → Finance → Payroll” | **P1 doc** |
| [`user-stories/shop-day-flow.md`](../user-stories/shop-day-flow.md) | Diagram still EoS | **P1 doc** |
| [`user-stories/epic-shift-close.md`](../user-stories/epic-shift-close.md) | Entire epic titled End of shift | **P1 doc** — rewrite or mark superseded → Daily Sheet |
| [`user-stories/epic-payroll.md`](../user-stories/epic-payroll.md) + [`roles-matrix.md`](../user-stories/roles-matrix.md) | Still “My Pay / Payroll register” as current | **P1 doc** |
| [`user-stories/epic-role-branch-admin.md`](../user-stories/epic-role-branch-admin.md) | Acceptance still checks EoS | **P1 doc** |
| Owner PDFs under `user-stories/pdf/` | process-close / process-pay / charts still old money path | **P1 doc** (owner-facing) |
| [`qa/SHOP-DAY-RUNBOOK.md`](./SHOP-DAY-RUNBOOK.md) | Banner says out of date; body still E1/F1/P1 | **P1 doc** — rewrite steps to Daily Sheet |
| [`OPS/MONEY-CONTRACT.md`](../OPS/MONEY-CONTRACT.md) | Supersession banner OK; body triangle still EoS/Payroll | **P1 doc** — rewrite binding sections |
| [`POS/`](../POS/) + [`PAYROLL/`](../PAYROLL/) flowchart packs | Historical; risk of training on retired path | **P2** — index as archive + point to daily-sheet |
| Archify `shop-day-flops.workflow.*` | Old FLOPS claim; daily-sheet diagrams exist | **P2** — mark FLOPS historical or redeliver |
| [`SYSTEM_GAPS.md`](../../SYSTEM_GAPS.md) | Stale scores (“domain docs ~0%”, old session) | **P2** — refresh or archive |
| Role guides (`docs/guides/roles/*`) | Mixed Daily Sheet vs My Pay language | **P2** spot-check |
| Customer seed portal gap | [`SEPTEMBER-2026-SEED.md`](./SEPTEMBER-2026-SEED.md) should state clearly: CRM yes, portal login no | **P2** (clarify) |
| September wipe before go-live | Owner decision not recorded as signed-off | **P1 ops decision** |

---

## Role coverage matrix (strict)

| Role | Nav-walk / role-qa | Money / Daily Sheet | Deep user stories | Portal / SMS |
|------|--------------------|---------------------|-------------------|--------------|
| Super Admin | Pass | Pass (sheets, Floor Board) | Partial (People/CRM deep unchecked) | Push: **not opted in** |
| ASA | Pass | Pass | Grants matrix not fully re-proven this month | Push: **not opted in** |
| Branch Admin Bacoor | Pass | Pass | Seed + smoke; live same-day FLOPS gap | — |
| Branch Admin Batangas (seed) | Shots | Pass | Seed staff only | — |
| Team Lead | Pass | Queue probe 20/20 | Full TL epic not re-accepted | — |
| Crew / Detailer | Pass (nav) | Attendance in seed | Deep task/pay stories stale (My Pay retired) | — |
| Sales / Marketing / Video / Ops Lead / Investor | Pass (nav + deny) | Investor finance RO | **Story deep-dives missing** | — |
| Customer | Home/account smoke | N/A | **Seed not portal-loggable**; demo customer only | SMS **blocked** ops |

---

## Continue checklist (ordered)

1. **Doc cutover (P1)** — Rewrite shop-day user stories + runbook + MONEY-CONTRACT body + owner PDFs to Daily Sheet; mark EoS/Payroll epics superseded.  
2. **Owner decisions** — Wipe or keep September seed; Ops Lead money panel yes/no; Google review URLs per live branch.  
3. **Ops blockers** — BrandTxt IP / Static IPs → `sms:egress` DELIVRD; Auth SMTP inbox proof; SA/ASA enable push → re-run push audit.  
4. **Rewrite `e2e:lifecycle-flops`** for Daily Sheet (or retire and point at `e2e:daily-sheet-money` + a new customer→queue→POS chain).  
5. **Optional product** — Small wipeable set of seed customers with portal auth (not all 893); Xero gaps only if owner prioritizes.  
6. **Do not** claim 100% production-ready until (3) is green and (1) no longer trains staff on the old money path.

---

## What “continue” means for the next session

Say which track to run:

- **A — Documentation cutover** (stories, runbook, contract, owner share)  
- **B — Ops proofs** (SMS, SMTP, push devices)  
- **C — FLOPS rewrite** (mutating Daily Sheet shop-day e2e)  
- **D — Persona deep QA** (Sales / Marketing / Video / Investor / Customer portal)  
- **E — Wipe September seed** (owner-approved only)
