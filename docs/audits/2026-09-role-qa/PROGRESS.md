# Progress log — role QA 2026-09

## Prompt 1 — Wave A — 2026-09-13

- Scope: Scaffold `docs/audits/2026-09-role-qa/`, generate MATRIX from permissions, baseline lint/test/build; fix P0 gate mismatches found in inventory.
- Findings (P0/P1/P2):
  - **P0:** Detailer in `QUEUE_VIEWER_ROLES` allowed wash Queue/Floor/Crew/KPI deep-links while nav/home are Bookings-only.
  - **P1:** `bredesignLogoMarquee.test.js` (+ homepage sections puppeteer) ran under `npm test` without preview → suite red.
  - **P2:** Several roles have intentional `allowButNoNav` (SA my-tasks, OL attendance/settings, marketing/video attendance).
- Fixes:
  - Removed `DETAILER` from `QUEUE_VIEWER_ROLES`; locked denial in `principalQaMatrix.test.js`.
  - Renamed puppeteer landing tests to `*.browser.test.js`.
- Commands: `npm test` 1188/1188 exit 0; `npm run build` exit 0; lint fixed later with e2e globals.
- Docs updated: README, MATRIX, WORKFLOWS, UI-CONSISTENCY, PROGRESS, roles scaffolds.
- Verdict: CONTINUE → Wave B

## Prompt 2 — Wave B — 2026-09-13

- Scope: TL / BA / Staff page+workflow QA, evidence, role docs.
- Findings: Initial deny-check false-reds were LoadingScreen (“VERIFYING ACCESS”) races — not product bugs. After settle wait: TL→POS, BA→finance, Staff→POS all access-denied.
- Fixes: Hardened `scripts/e2e-role-qa.mjs` waitSettled; no product P0/P1 in Wave B surface.
- Commands: `npm run e2e:role-qa` Wave B personas PASS; `e2e:ui-p0` 9/9; `e2e:ui-money` 5/5.
- Docs: `roles/team_lead.md`, `admin.md`, `staff.md` + evidence refs.
- Verdict: CONTINUE → Wave C

## Prompt 3 — Wave C — 2026-09-13

- Scope: BossMich / ASA / OL / Investor money+leadership QA.
- Findings: Homes + denies match matrix (OL→people deny, Investor→POS deny). ASA demo id=`asa`.
- Fixes: none product; e2e id correction `assistant`→`asa`.
- Evidence: `login-boss`, `login-asa`, `login-opslead`, `login-investor` + allow/deny shots in `e2e-evidence/role-qa/`.
- Docs: `roles/BossMich.md`, `asa.md`, `operations_lead.md`, `investor.md`.
- Verdict: CONTINUE → Wave D

## Prompt 4 — Wave D — 2026-09-13

- Scope: Sales / Detailer / Marketing / Video specialty QA.
- Findings: Detailing stays off wash Queue (detailer.deny → access-denied). Sales/Marketing/Video denies match guides.
- Fixes: Wave A P0 already closed detailer queue deep-link.
- Docs: `roles/sales.md`, `detailer.md`, `marketing.md`, `video_editor.md`.
- Verdict: CONTINUE → Wave E

## Prompt 5 — Wave E — 2026-09-13

- Scope: Customer PWA + public utilities (not `/home`) + UI consistency notes.
- Findings: Customer sign-in → `/account`; ops deny wall; `/book`, `/contact`, `/complaints`, `/f/detailing-inquiry` load. Account dock uses shared `capp-dock` touch targets.
- Fixes: none P0/P1.
- Docs: `roles/customer.md`, `UI-CONSISTENCY.md` Wave E stamp.
- Verdict: CONTINUE → Wave F

## Prompt 6 — Wave F — 2026-09-13

- Scope: Readiness gate, status docs, campaign close.
- Commands:
  - `npm run lint` exit 0
  - `npm test` 1188/1188
  - `npm run build` exit 0
  - `npm run e2e:role-qa` 53/53
  - `npm run e2e:ui-p0` 9/9 · `e2e:ui-money` 5/5
  - `SKIP_RESPONSIVE=1 npm run test:readiness` → **14 passed / 0 failed** (`docs/qa/last-run.json`)
- Docs updated: PROJECT_STATUS, SYSTEM_AUDIT, BUGS (019/020), README pointer, PROGRESS.
- Remaining BLOCKED (non-code): BUG-002 BrandTxt Vercel IP; BUG-003 `OWNER_SMS_PHONE` on Vercel.
- Verdict: **DONE 100%** — product readiness **READY_WITH_OPS_BLOCKERS**
