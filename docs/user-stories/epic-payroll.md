# Epic: Payroll & compensation

**Goal:** One salary path — floor confirm posts pay; crew page shows estimates only.

## US-PAY-01 · Floor payroll run

**As** Super Admin or ASA (finance grant)  
**I want** to confirm floor payroll from paid POS + attendance  
**So that** wash pool and ceramic lines post once with sale proof  

**Acceptance**

- [x] `buildRunPayrollPayload` sends `sale_id` + `wash_pool_minor` proof
- [x] Wash pool = wash-eligible sales × pool % × present **bay crew** (not detailer/TL/office)
- [x] Ceramic lines require assignee; confirm blocked when missing
- [x] Overlap / double-pay errors named in `run_payroll` RPC / migration

**Test seam:** `tests/payrollFullStack.test.js`, `tests/dailyOpsWorkflow.test.js`

---

## US-PAY-02 · Fixed packages (company)

**As** Super Admin  
**I want** a separate fixed wizard for monthly packages  
**So that** bay floor pay and company salaries stay separate tracks  

**Acceptance**

- [x] Fixed run includes packages only; floor run excludes packages
- [x] Company packages book to `hq` when branch omitted
- [x] Kinds: `package_fixed`, `package_hybrid`, `wash_pool`, `ceramic_*`

**Test seam:** `tests/payrollSeam.test.js`, `tests/branchFinanceHardening.test.js`, `tests/shopDaySettlement.test.js`

---

## US-PAY-03 · Crew compensation estimate

**As** branch admin or team lead  
**I want** today’s compensation estimate on Crew  
**So that** I can plan shifts without confusing estimate for posted pay  

**Acceptance**

- [x] Crew page does not insert wash-pool expenses
- [x] Banner: “Estimate only — not posted pay” (confirm on Payroll)
- [x] Settings live under `/operations/settings/payroll`

**Test seam:** `tests/payrollFullStack.test.js`, `tests/userStoriesCoverage.test.js`

---

## US-PAY-04 · My pay (crew)

**As** crew  
**I want** to see my posted payout from latest run  
**So that** I trust payroll over the Crew estimate  

**Acceptance**

- [x] `/operations/my-pay` sums latest posted run lines for `staff_id`
- [x] Super Admin denied My Pay nav and route
- [x] Branch scope via `branchSlugsForOwnPay`

**Test seam:** `tests/payrollSeam.test.js`, `tests/leftoverUxSeam.test.js`, `tests/branchFinanceHardening.test.js`

---

## US-PAY-05 · BA salary draft (not confirm)

**As** Branch Admin  
**I want** to edit extra pay / deductions on End of Shift as draft notes  
**So that** SA/ASA see my corrections on the payroll wizard without me posting pay  

**Acceptance**

- [x] BA cannot open Payroll register (`canAccessPayroll` false)
- [x] BA cannot call `run_payroll` (`canRunPayroll` false)
- [ ] EoS `submitted.salary_draft_extras` surfaces on SA floor wizard (Phase 6)
- [x] Money contract C4 / G3 hybrid documented

**Test seam:** `tests/moneyContract.test.js`
