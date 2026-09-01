# Epic: Finance & books

**Goal:** Single books hub — P&L, purchases, shift close, reports — filter-scoped and fail-visible.

## US-FIN-01 · Finance dashboard

**As** Super Admin, ASA, or Investor  
**I want** branch- and date-scoped books  
**So that** net profit reflects paid POS and posted expenses  

**Acceptance**

- [x] Loads `finance_daily_pl`, `daily_sales_summary`, `expenses`
- [x] Branch scope fails closed (`scopeBranch` → `__none__` when no profile)
- [x] Load failure shows inline retry banner
- [x] Reports tab replaces legacy `/operations/reports`

**Test seam:** `tests/financeData.test.js`, `tests/leftoverUxSeam.test.js`, `tests/userStoriesCoverage.test.js`, `tests/opsMoneyAttendanceSeam.test.js`

---

## US-FIN-02 · Expense reports lifecycle

**As** ASA  
**I want** to submit branch expense reports  
**So that** SA approve → pending payment → mark paid hits P&L once  

**Acceptance**

- [x] ASA draft/submit with branch ACL
- [x] Approve lands `pending_payment`, not immediate P&L
- [x] `mark_paid` / `approve_paid` posts to books

**Test seam:** `tests/branchFinanceHardening.test.js`

---

## US-FIN-03 · Reports & retention

**As** leadership  
**I want** best sellers and retention in the filter window  
**So that** ops reports match Finance date/branch filters  

**Acceptance**

- [x] `aggregateBestSellers` scoped by range + branch
- [x] Shift close reports show payroll coverage label
- [x] P&L rollup: income from paid sales, expenses include payroll posts; branches do not merge

**Test seam:** `tests/dailyOpsWorkflow.test.js`, `tests/crmPart7.test.js`, `tests/leftoverUxSeam.test.js`

---

## US-FIN-04 · Investor read-only books

**As** investor  
**I want** Finance hub only  
**So that** I see performance without floor or people tools  

**Acceptance**

- [x] Home → `/operations/finance`
- [x] Nav = Finance only; reports via Finance tab
- [x] `allowRoute` denies queue, POS, people

**Test seam:** `tests/permissions.test.js`, `tests/principalQaMatrix.test.js`
