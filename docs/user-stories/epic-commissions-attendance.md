# Epic: Late / absent / cash advance / detailer commission

**Goal:** Multi-branch shop-day pay matches who actually worked, who was assigned, and what Finance posted. Bacoor numbers never leak into Imus.

## US-PAY-05 · Late clock-in (naabutan nila)

**As** Super Admin  
**I want** late crew paid only for the remaining shift  
**So that** a 9:00 clock-in on an 8:00–16:00 shift earns 7/8 of a present share, not a flat 0.7

**Acceptance**

- [x] On-time present weight = 1
- [x] Clock-in 60 minutes late on an 8h shift → weight 0.875
- [x] Status `late` without a clock still falls back to 0.7
- [x] Wash pool remainder lands on the last crew row (no ₱0.01 drift)

**Test seam:** `tests/dailyOpsNetwork.test.js`

---

## US-PAY-06 · Absent crew

**As** Team Lead  
**I want** absent crew off the board and off the pool  
**So that** they get no wash share, no car, and no detailing commission

**Acceptance**

- [x] `isAssignableAttendanceStatus('absent')` is false
- [x] Absent roster rows have attendance weight 0
- [x] Assigned but absent detailer holds commission as `missing_assignee` (confirm blocked)

**Test seam:** `tests/dailyOpsNetwork.test.js`, `tests/dailyOpsWorkflow.test.js`

---

## US-PAY-07 · Cash advance deduct

**As** Super Admin  
**I want** approved cash advances deducted in the payroll wizard  
**So that** CA never inflates sales and never auto-strips pay

**Acceptance**

- [x] `applyCashAdvanceDeductions` only accepts `approved` / `accepted` / `paid`
- [x] Pending/draft CA is ignored
- [x] Deduct is a labeled `adjustment_deduct` line
- [x] `buildPayrollPreview` does not auto-apply CA (money contract B4)

**Test seam:** `tests/dailyOpsNetwork.test.js`

---

## US-PAY-08 · Assigned detailer commission (every path)

**As** a detailer  
**I want** commission on every job I am assigned  
**So that** booking pipeline and walk-in POS pay me the same way

**Acceptance**

- [x] Booking with `assigned_staff_id` / `detailer_staff_id` pays that person
- [x] Walk-in POS sale with `assigned_staff_id` pays that person
- [x] Expense row may stamp `staff_id` via `assignedDetailerId`
- [x] Commission stays on the job’s branch (Imus job ≠ Bacoor pool)
- [x] Detailers are not in the wash pool (bay crew only)

**Test seam:** `tests/dailyOpsNetwork.test.js`

---

## US-PAY-09 · Multi-branch isolation

**As** Super Admin  
**I want** each branch-day settled on its own POS  
**So that** Bacoor wash never funds Imus coating books

**Acceptance**

- [x] Wash pool keyed by `branch|day`
- [x] Pending floor queue is one row per accepted branch-day
- [x] Posted floor run covers only that branch-day
- [x] Finance P&L rollup is per-branch rows, not a merged fiction

**Test seam:** `tests/dailyOpsNetwork.test.js`, `tests/dailyOpsWorkflow.test.js`
