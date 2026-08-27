# Epic: End of shift & close review

**Goal:** Branch Admin attests drawer; Finance accepts; Payroll unlocks floor confirm.

## US-CLOSE-01 · End of shift wizard

**As** branch admin  
**I want** to submit end-of-shift when the day had activity  
**So that** drawer cash/GCash/card totals are attested against POS proof  

**Acceptance**

- [x] Offer close only when sales, expenses, or CA activity exist (`shopDayShouldClose`)
- [x] Total sales = paid POS (wash + detailing + merch), not CA repayments
- [x] Carwash salary cell = wash-pool preview only (ceramic crew is not extra carwash salary)
- [x] Override requires reason when submitted ≠ baseline
- [x] One open close per branch per business day (unique index)

**Test seam:** `tests/shiftClose.test.js`, `tests/shopDaySettlement.test.js`, `tests/dailyOpsWorkflow.test.js`, `tests/userStoriesCoverage.test.js`

---

## US-CLOSE-02 · Finance shift review

**As** ASA or Super Admin  
**I want** to accept or reject submitted closes  
**So that** attested days unlock payroll pending floor  

**Acceptance**

- [x] `review_shift_close` RPC from Finance Shift Close tab
- [x] Accepted close → notify SA/ASA (`payroll.pending_floor`)
- [x] One close per branch per business day
- [x] P&L still keys off paid POS, not override fiction

**Test seam:** `tests/branchFinanceHardening.test.js`, `tests/dailyOpsWorkflow.test.js`, `tests/shopDaySettlement.test.js`

---

## US-CLOSE-03 · Pending floor gate

**As** Super Admin  
**I want** pending floor pay visible before I confirm payroll  
**So that** I never pay without Finance-accepted close (when hard gate on)  

**Acceptance**

- [x] `buildPendingFloorPayrollQueue` lists accepted days without floor run
- [x] Side-by-side close attested ₱ vs POS proof ₱
- [x] `pending_floor_optional = false` hard-blocks floor confirm (`floorConfirmBlockedByPendingCloses` + Payroll confirm)
- [x] After floor run posts, coverage label = “posted”

**Test seam:** `tests/payrollSeam.test.js`, `tests/dailyOpsWorkflow.test.js`, `tests/moneyContract.test.js`
