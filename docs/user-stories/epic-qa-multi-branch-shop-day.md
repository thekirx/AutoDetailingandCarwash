# Epic: Multi-branch shop-day QA (PO / Scrum)

**Goal:** Prove one Manila shop day works the same on **every branch** (Bacoor, Imus, Silang, …) — not a Bacoor-only demo.

**Owner / PM:** Product Owner  
**Facilitation:** Scrum Master (this epic is the sprint acceptance pack)  
**Engineering:** Full-stack + Principal QA  

**Locked path:** [shop-day-flow.md](./shop-day-flow.md) · Money: `docs/OPS/MONEY-CONTRACT.md`  
**Primary seam:** `tests/dailyOpsNetwork.test.js` (+ `dailyOpsWorkflow`, `payrollSeam`, `shiftClose`)

---

## Sprint DoD (this epic)

- [x] Crew clock: present / late / absent (`US-PAY-05`, `US-PAY-06`)
- [x] Live payroll uses `checked_in_at` + shift window (remaining-shift “naabutan”)
- [x] Geo `toISOString()` UTC clocks map through **Asia/Manila** (not UTC digits)
- [x] Multi-branch payroll indexes **branch×weekday** operating hours (not one branch’s shift for all)
- [x] Admin override clock `combineLocalDateAndTime` writes Manila `+08`
- [x] Geo late status (`isLateVsShift`) compares against Asia/Manila, not browser local
- [x] TL wash tickets → POS (wash pool bay crew only)
- [x] Sales detailing booking + walk-in POS → assigned detailer commission
- [x] Solo ceramic 20% / split 10+10 / card fee before split
- [x] Absent = no car, no wash share, no detailer commission (hold `missing_assignee`)
- [x] CA approve → wizard deduct only (no auto; B4)
- [x] BA end of shift → Finance accept → floor payroll → P&L (per branch-day)
- [x] Branch isolation: Bacoor ≠ Imus ≠ Silang

---

## US-QA-01 · Morning clock (all branches)

**As** crew  
**I want** geo time-in at **my** branch  
**So that** late pay uses what I actually naabutan  

**Acceptance**

- Present weight 1; late with `checked_in_at` + shift → remaining/scheduled (e.g. 09:00 on 08:00–16:00 → **0.875**)
- UTC ISO from geo time-in (`…T01:00:00.000Z` = 09:00 Manila) → same **0.875** (never parse UTC hour digits)
- Status `late` with no clock → **0.7**
- Absent / no row → weight **0**, not assignable

**Test:** `dailyOpsNetwork` · clock math + `attendanceRowForPayroll`

---

## US-QA-02 · Midday tickets

**As** Team Lead / Sales  
**I want** wash queue + detailing bookings per branch  
**So that** POS proof stays branch-scoped  

**Acceptance**

- Wash tickets on `/operations/queue`
- Detailing on Bookings with `assigned_staff_id`
- Walk-in POS detailing with `assigned_staff_id` pays the same detailer

**Test:** `dailyOpsNetwork` · detailer paths · wiring scan

---

## US-QA-03 · Afternoon POS + commissions

**As** Branch Admin  
**I want** paid POS to drive wash pool + ceramic drafts  
**So that** SA payroll matches the floor  

**Acceptance**

- Wash pool 35% default; late earns less than present; absent earns 0
- Ceramic: solo 20%; with detailer 10/10 after shirt/card rules
- Detailers never enter wash pool

**Test:** `dailyOpsNetwork` · isolation + ceramic scenarios

---

## US-QA-04 · Night close → Finance → payroll

**As** BA then SA  
**I want** each branch-day closed and paid alone  
**So that** Imus coating never funds Bacoor wash  

**Acceptance**

- EoS attests paid POS; Finance `review_shift_close`
- Pending floor per branch-day; `run_payroll` claims that branch only
- CA: approve on Payroll; deduct manual in wizard; never auto

**Test:** `dailyOpsNetwork` · close → books · CA deduct

---

## Out of scope (explicit)

- Changing money-contract B4 (CA auto-deduct stays off)
- Weather / marketing / customer portal
- Brand Assets dumps in repo root
