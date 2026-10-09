# Epic: Ops Lab, Data Center, Console & Floor Board


> **Updated 2026-10-09.** Ops Lab is RETIRED: the `/operations/roadmap` page, nav links and `/api/notify-ops-lab` were removed and old links redirect home. The Console page was retired on 2026-10-08. Data Center and the Floor Board remain; Super Admin, ASA and Ops Lead land on the Floor Board.

**Goal:** Network tools for SA / Ops Lead — not Branch Admin money paths.

## US-OPSLAB-01 · Ops Lab roadmap (retired 2026-10-09)

**As** Operations Lead  
**I want** one planning surface (the Planner) instead of a separate roadmap  
**So that** tasks, forms and events live in one place  

**Acceptance**

- [x] No Ops Lab link for any role; `/operations/roadmap` redirects to the role home
- [x] Ops Lead: Floor Board home, planner + POS + queue, all branches, **no** attendance clock
- [x] Old `ops_lab.*` in-app notifications deleted; `ops_roadmap_*` / `ops_lab_*` tables kept as history

**Test seam:** `tests/operationsLead.test.js`, `CONTEXT.md` (Operations Lead)

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
