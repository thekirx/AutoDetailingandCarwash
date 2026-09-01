# Epic: Ops Lab, Data Center, Console & Floor Board

**Goal:** Network tools for SA / Ops Lead — not Branch Admin money paths.

## US-OPSLAB-01 · Ops Lab roadmap

**As** Operations Lead  
**I want** `/operations/roadmap`  
**So that** custom types/statuses notify peers without touching payroll  

**Acceptance**

- [x] `canAccessOpsRoadmap` for Ops Lead / allowed roles
- [x] Ops Lead: planner + POS + queue, all branches, **no** attendance clock
- [x] Roadmap page + audited actions seams

**Test seam:** `tests/operationsLeadRoadmap.test.js`, `CONTEXT.md` (Operations Lead)

---

## US-DC-01 · Data Center

**As** Super Admin  
**I want** `/operations/data-center`  
**So that** catalog/CRM import and floor/finance export stay SA-only  

**Acceptance**

- [x] SA-only access
- [x] Standard purge / export contract documented in tests

**Test seam:** `tests/dataCenter.test.js`, `tests/principalQaFlows.test.js`

---

## US-CONSOLE-01 · Admin console & Floor Board

**As** Super Admin or ASA with console grant  
**I want** Console + Floor dashboard  
**So that** network lanes and sales totals are visible without fake money KPIs as pay  

**Acceptance**

- [x] Console gated; ASA grant can deny
- [x] Floor board roster / sales board helpers
- [x] BA Command nav keeps POS + floor, denies finance/CRM/people

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/floorSalesBoard.test.js`, `tests/floorBoardLanes.test.js`, `tests/superAdminFloor.test.js`

---

## US-BRANCH-01 · Branches manage

**As** Super Admin  
**I want** branch hours, geo, and public visibility  
**So that** clock geofence and homepage coming-soon match live rows  

**Acceptance**

- [x] Branch operating hours helpers
- [x] Homepage coming-soon from branch rows, not hardcoded city

**Test seam:** `tests/branchOperatingHours.test.js`, `tests/leftoverUxSeam.test.js`, `tests/homeBranches.test.js`
