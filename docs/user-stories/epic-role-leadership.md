# Epic: Leadership personas (Super Admin, ASA, Investor)

**Goal:** Network books and grants without confusing investor read-only with SA write.

## US-SA-01 · Super Admin (`BossMich`)

**As** Super Admin  
**I want** Console home and full ops keys  
**So that** People, Daily Sheet approval, Finance, Data Center stay under one owner  

**Acceptance**

- [x] Home → `/operations/console`
- [x] Finance (incl. Daily sheets approve / return / reopen) + People + Data Center + Cars
- [x] No floor attendance clock; no pay estimate (approves crew pay on the Daily Sheet instead)
- [x] Command nav never links a denied page

**Test seam:** `tests/principalQaMatrix.test.js`, `tests/adminPortal.test.js`, `tests/dailyOpsWorkflow.test.js`

---

## US-ASA-01 · Assistant Super Admin

**As** ASA  
**I want** Console home with **grant-scoped** tools  
**So that** SA can narrow Finance write, CRM, Content, etc.  

**Acceptance**

- [x] Home → `/operations/console`
- [x] Default grants ≈ SA minus SA-only (`cars`, `data-center`)
- [x] Denied grants block CRM / Content / console / notifications / queue chrome
- [x] `branches_all` independent of `queue_all`
- [x] Approves Daily Sheets only with `finance_write`; sees own pay estimate on Attendance (unlike SA)

**Test seam:** `tests/principalQaMatrix.test.js`, `tests/leftoverUxSeam.test.js`, `tests/assistantGrantsEditor.test.js`

---

## US-INV-01 · Investor

**As** investor  
**I want** Finance only  
**So that** I see P&L without floor or people tools  

**Acceptance**

- [x] Home → `/operations/finance`
- [x] Nav = Finance alone; reports via Finance tab
- [x] `allowRoute` denies queue, POS, people (retired payroll / my-pay routes redirect away)
- [x] Read-only books (`canWriteFinance` false)

**Test seam:** `tests/principalQaMatrix.test.js`, `tests/permissions.test.js`, `tests/requestBriefE2e.test.js`, `tests/rolePersonaCoverage.test.js`
