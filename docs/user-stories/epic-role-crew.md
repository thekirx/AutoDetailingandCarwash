# Epic: Crew (staff) persona

**Goal:** Clock in, do assigned tasks, see today's pay estimate — no queue manager or POS.

**Home:** `/operations/attendance`

## US-CREW-01 · Attendance home

**As** crew (`staff`)  
**I want** attendance as my home  
**So that** clock-in is the first action of the day  

**Acceptance**

- [x] Home → `/operations/attendance`
- [x] `canUseAttendanceClock` when enabled + geo when required
- [x] Denied: queue, dashboard, POS, Finance, People, Bookings

**Test seam:** `tests/principalQaMatrix.test.js`, `tests/staffScope.test.js`, `tests/attendanceGeo.test.js`, `tests/dailyOpsWorkflow.test.js`

---

## US-CREW-02 · My Tasks + today's pay estimate

**As** crew  
**I want** assigned planner cards and a pay estimate on Attendance  
**So that** I know roughly what today's Daily Sheet will pay me  

**Acceptance**

- [x] My Tasks for assignees
- [x] Attendance shows "Wash pool estimate today — ₱… unpaid" for the signed-in person (`seesOwnPayEstimate`)
- [x] Super Admin and Investor see no estimate (contrast)
- [x] Actual pay = the salary line on the branch's **approved** Daily Sheet; My Pay (`/operations/my-pay`) was retired 2026-10-01 and redirects to `/operations`

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/plannerTasks.test.js`, `src/pages/crew/CrewAttendancePanels.jsx`

---

## US-CREW-03 · Wash pool honesty

**As** crew  
**I want** late/absent to change my pool share  
**So that** pay matches who naabutan the shift  

**Acceptance**

- [x] On-time weight 1; 60 min late on 8h → 0.875
- [x] Absent → weight 0, not assignable
- [x] Bay crew only in wash pool (not detailer role)

**Test seam:** `tests/dailyOpsNetwork.test.js`, `docs/user-stories/epic-commissions-attendance.md`
