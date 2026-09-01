# Epic: Branch Admin persona

**Goal:** One bay’s money day — POS, close, attendance, planner — without network People/Finance.

**Home:** `/operations/pos`

## US-BA-01 · Command chrome = allowRoute

**As** Branch Admin  
**I want** only BA route keys  
**So that** Command never links a page I cannot open  

**Acceptance**

- [x] Home → `/operations/pos`
- [x] Allowed: dashboard, queue, attendance, pos, reviews, planning, roadmap, history, my-pay, audit
- [x] Denied: finance, CRM, people, console, payroll, inventory, bookings

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/branchAdminShell.test.js`, `tests/principalQaMatrix.test.js`

---

## US-BA-02 · Checkout → end of shift

**As** Branch Admin  
**I want** Pay queue + merch + expenses + EoS  
**So that** paid POS is attested that night  

**Acceptance**

- [x] POS shell tabs: checkout, pending, expenses, dashboard (no cash-advance tab)
- [x] End of shift when activity exists
- [x] Override reason when submitted ≠ baseline

**Test seam:** `tests/posWorkflowSeam.test.js`, `tests/payrollFullStack.test.js`, `tests/shiftClose.test.js`, `tests/dailyOpsWorkflow.test.js`

---

## US-BA-03 · Crew estimate only

**As** Branch Admin  
**I want** today’s pool estimate without posting pay  
**So that** I plan shifts while SA confirms Payroll  

**Acceptance**

- [x] Estimate banner; no wash-pool expense insert from Crew
- [x] My Pay for own posted lines

**Test seam:** `tests/userStoriesCoverage.test.js`, `tests/payrollFullStack.test.js`
