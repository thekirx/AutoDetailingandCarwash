# Remaining work — principal PM audit (2026-10-05, re-audited 2026-10-07)

> **2026-10-07 update (principal full-system audit).** Fixed this pass: `MONEY-CONTRACT.md` approve grant corrected `finance_write` → `finance_view` (code was already right); phantom "Pay" dock removed from 3 role guides; `super-admin-asa.md` rewritten to the real nav (Console/Crew/Payroll do not exist); live dead breadcrumb `/operations/console` fixed in `AuditLogPage.jsx`; archive banners added to 4 stale money-path docs; `SYSTEM_AUDIT.md` retired-rows + test counts corrected. **Still open and higher priority than most items below: the entire 2026-10-06 work unit is uncommitted** — see "Uncommitted work at risk" in `PROJECT_STATUS.md`.

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

### Attendance spoof block, CRUD dialogs, data hygiene (2026-10-06)

| Item | Status |
|------|--------|
| Spoofed-location time-in blocked (`geo_clock_in`, `attendance_location_alerts`) | **Applied in prod** (migration `attendance_geo_spoof_alerts`); client already calls the RPC |
| E2E leftovers (10 bookings, 3 `E2E Customer …` rows; no sale / transaction) | **Archived in prod** (`archive_e2e_leftovers`, reversible) |
| `TestName` (July sale) and `test run` (one transaction) | **Left live** — tied to money rows; owner decides |
| CRUD create forms → dialogs (Branches, Products, Cars, SMS, Memberships, Planning, Services, Finance ×5, People ×2, Notifications ×2) | **Done** — seam `tests/crudCreateModals.test.js` |
| Button handlers that `await fetch` with no `catch` | **Fixed once** — global `unhandledrejection` → "Network error" toast (`src/main.jsx`) |
| Dead-button crawl (`scripts/_dead-button-crawl.mjs`, writes aborted) | Floor personas deep (TL / Sales / Detailer / Marketing / Crew / Video): 5 flags, all false positives (native required-field block, re-selecting the active option, repeated wizard error). **SA / ASA / BA pages only got 2 clicks each — not a real crawl yet** |
| Supabase advisors | No new findings from today's migrations. Open, pre-existing: 4 public `SECURITY DEFINER` views (TV board / home stats), leaked-password protection off (dashboard toggle) |

---

## Fresh verify (this session, 2026-10-05)

| Check | Command | Result |
|-------|---------|--------|
| Unit | `npm test` | **1518/1518**, exit 0 (re-verified 2026-10-07) |
| Lint | `npx eslint .` | exit **0** (re-verified 2026-10-07) |
| Build | `npm run build` | exit **0** (re-verified 2026-10-07) |
| Production `geo_clock_in` | RPC present; function body reached ("Sign in to time in") | **PASS** — CHANGELOG's "applied in prod" is true |
| Production `attendance_location_alerts` | Table present, 0 rows | **PASS** — the nav-walk 404 evidence predates the apply |
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
| `e2e:lifecycle-flops` | Full shop-day click path (customer book → pay → sheet) | **UPDATED** — Daily Sheet read-only + screenshots; money writes stay on `e2e:daily-sheet-money`. **Re-run on next ship** to refresh evidence |
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

## Documentation debt

Canonical Daily Sheet path is now in stories + runbook + MONEY-CONTRACT (2026-10-05 cutover). Matrix: [`ROLE-STORY-EVIDENCE.md`](./ROLE-STORY-EVIDENCE.md).

| Artifact | Problem | Priority |
|----------|---------|----------|
| Owner pack `USER-STORIES-OWNER.html/.pdf` | Regenerated from Daily Sheet stories (2026-10-05) | **Done this slice** — re-verify after next copy change |
| Owner PDFs `user-stories/pdf/process-*` (legacy per-process) | May still show old close/pay path | **P2 doc** — prefer OWNER pack |
| [`POS/`](../POS/) / [`PAYROLL/`](../PAYROLL/) packs | Archive — train from daily-sheet only | **P2** |
| ~~[`user-stories/README.md`](../user-stories/README.md)~~ | ~~EoS night~~ → **Done** Daily Sheet | — |
| ~~[`user-stories/shop-day-flow.md`](../user-stories/shop-day-flow.md)~~ | ~~EoS diagram~~ → **Done** | — |
| ~~[`user-stories/epic-shift-close.md`](../user-stories/epic-shift-close.md)~~ | ~~Titled End of shift~~ | **Done** — Daily Sheet close epic, superseded banner |
| ~~[`user-stories/epic-payroll.md`](../user-stories/epic-payroll.md) + [`roles-matrix.md`](../user-stories/roles-matrix.md)~~ | ~~My Pay as current~~ | **Done** — crew pay on the Daily Sheet |
| ~~[`user-stories/epic-role-branch-admin.md`](../user-stories/epic-role-branch-admin.md)~~ | ~~EoS acceptance~~ | **Done** |
| ~~Role epics: crew, leadership, ops lead, team lead, detailer, multi-branch QA~~ | ~~My Pay / `canViewOwnPay` / `run_payroll` as current~~ | **Done 2026-10-06** — Attendance pay estimate + approved Daily Sheet |
| Owner PDFs under `user-stories/pdf/` | process-close / process-pay / charts still old money path | **P1 doc** (owner-facing) — prefer the regenerated OWNER pack |
| ~~[`qa/SHOP-DAY-RUNBOOK.md`](./SHOP-DAY-RUNBOOK.md)~~ | ~~Body still E1/F1/P1~~ | **Done** — Daily Sheet runbook |
| ~~[`OPS/MONEY-CONTRACT.md`](../OPS/MONEY-CONTRACT.md)~~ | ~~Body still EoS/Payroll~~ | **Done 2026-10-06** — binding sections rewritten (IDs kept, retired ones marked) |
| [`POS/`](../POS/) + [`PAYROLL/`](../PAYROLL/) flowchart packs | Historical; risk of training on retired path | **P2** — index as archive + point to daily-sheet |
| Archify `shop-day-flops.workflow.*` | Old FLOPS claim; daily-sheet diagrams exist | **P2** — mark FLOPS historical or redeliver |
| [`SYSTEM_GAPS.md`](../../SYSTEM_GAPS.md) | Stale scores (“domain docs ~0%”, old session) | **P2** — refresh or archive |
| ~~Role guides (`docs/guides/roles/*`)~~ | ~~Mixed Daily Sheet vs My Pay language~~ | **Done 2026-10-06** — crew, ops lead, team lead, video editor docks match `permissions.js` |
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

1. **Doc cutover (P1)** — Stories, runbook, MONEY-CONTRACT, role guides done (2026-10-06). Left: legacy per-process owner PDFs under `user-stories/pdf/`.  
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
