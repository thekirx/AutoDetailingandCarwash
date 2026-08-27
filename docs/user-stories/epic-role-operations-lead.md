# Epic: Operations Lead persona

**Goal:** Network-wide ops (queue ∪ BA tools, all branches) with Ops Lab — **no** attendance clock, **no** Payroll register.

**Home:** `/operations/roadmap`

## US-OL-01 · Ops Lab home

**As** Operations Lead  
**I want** `/operations/roadmap` as home  
**So that** custom types/statuses notify peers without inventing payroll  

**Acceptance**

- [x] Home → `/operations/roadmap`
- [x] `canAccessOpsRoadmap` true
- [x] Multi-branch forms / EoS capability without SA People

**Test seam:** `tests/operationsLeadRoadmap.test.js`, `tests/rolePersonaCoverage.test.js`

---

## US-OL-02 · Floor + POS without clock

**As** Operations Lead  
**I want** queue edit + POS + planner edit across branches  
**So that** I cover TL∪BA work network-wide  

**Acceptance**

- [x] Queue view/edit; POS access
- [x] Attendance **register** allowed; **floor clock denied** (`canUseAttendanceClock` false)
- [x] My Pay yes; Payroll register no
- [x] Denied: People, Data Center, Cars catalog, CRM, Content

**Test seam:** `tests/operationsLeadRoadmap.test.js`, `tests/permissions.test.js`, `CONTEXT.md` (Operations Lead)

---

## US-OL-03 · Detailing compensation is service-agnostic

**As** Operations Lead  
**I want** detailing splits not hard-coded to ceramic-only labels  
**So that** tint / paint maint / coating drafts share one path  

**Acceptance**

- [x] Detailing expense keys accept `detailing:` and legacy `ceramic:`
- [x] Documented in shop-day / compensation seams

**Test seam:** `tests/dailyOpsNetwork.test.js`, `tests/opsMoneyAttendanceSeam.test.js`
