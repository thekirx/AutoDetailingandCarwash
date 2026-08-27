# Epic: Crew (staff) persona

**Goal:** Clock in, do assigned tasks, see posted pay — no queue manager or POS.

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

## US-CREW-02 · My Tasks + My Pay

**As** crew  
**I want** assigned planner cards and posted payroll  
**So that** I trust Pay over any Crew estimate  

**Acceptance**

- [x] My Tasks for assignees
- [x] My Pay sums latest posted run for `staff_id`
- [x] Super Admin denied My Pay (contrast)

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/payrollSeam.test.js`, `tests/plannerTasks.test.js`

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
