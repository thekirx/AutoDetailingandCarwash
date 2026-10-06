# Epic: Team Lead persona

**Goal:** Wash-only floor control — queue, attendance honesty, KPI glance — without Finance pay tools.

**Home:** `/operations/queue` (`redirectForRole`)

## US-TL-01 · Queue dock

**As** Team Lead  
**I want** Floor + Queue + Attendance + Crew on my dock  
**So that** same-day wash moves without opening detailing Bookings  

**Acceptance**

- [x] Home → `/operations/queue`
- [x] Can open queue + queue-new; wash-only family
- [x] Detailing stays on Bookings (Sales / Detailer)
- [x] More menu: History, KPI, My Tasks, Planner, Pay

**Test seam:** `tests/teamLeadScope.test.js`, `tests/teamLeadQueueManager.test.js`, `tests/principalQaMatrix.test.js`, `tests/leftoverUxSeam.test.js`

---

## US-TL-02 · Assign cars only to present / late

**As** Team Lead  
**I want** absent crew off the assign list  
**So that** wash-pool and board match who is here  

**Acceptance**

- [x] `isAssignableAttendanceStatus('absent')` false
- [x] Present / late still assignable
- [x] Can clock when `attendance_enabled`

**Test seam:** `tests/dailyOpsWorkflow.test.js`, `tests/dailyOpsNetwork.test.js`

---

## US-TL-03 · Quality + pay visibility

**As** Team Lead  
**I want** Failed QA marks and my pay estimate  
**So that** quality and today's pay stay visible  

**Acceptance**

- [x] TL can mark Failed QA; Sales cannot
- [x] Attendance shows own pay estimate; actual pay = TL daily rate on the branch's approved Daily Sheet (My Pay retired 2026-10-01)
- [x] No POS / Finance / People routes

**Test seam:** `tests/principalQaFlows.test.js`, `tests/leftoverUxSeam.test.js`, `tests/teamLeadScope.test.js`
