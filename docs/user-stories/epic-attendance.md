# Epic: Attendance register (beyond clock-in)

**Goal:** Who is present is honest for queue assign and wash pool — SA configures; floor clocks.

## US-ATT-01 · Attendance page

**As** Branch Admin or Team Lead  
**I want** `/operations/attendance`  
**So that** I can see and override day status when needed  

**Acceptance**

- [x] Role can open attendance when `canAccessAttendance`
- [x] Ops Lead does **not** use floor clock (`canUseAttendanceClock` false)
- [x] Statuses feed `isAssignableAttendanceStatus` on queue

**Test seam:** `tests/attendanceSystem.test.js`, `tests/attendanceRoles.test.js`, `tests/dailyOpsWorkflow.test.js`

---

## US-ATT-02 · Geofence & toggles

**As** crew  
**I want** geo time-in when the branch requires it  
**So that** remote clock-ins do not count as present  

**Acceptance**

- [x] `canClockAttendance` respects `attendance_enabled`
- [x] `isInsideGeofence` distance math
- [x] Crew panels wire `geoTimeIn` / geofence

**Test seam:** `tests/attendanceGeo.test.js`, `tests/dailyOpsNetwork.test.js`, `tests/dailyOpsWorkflow.test.js`

---

## US-ATT-03 · Late / absent pay effects

**As** Super Admin  
**I want** late and absent to change wash-pool shares  
**So that** pay matches who naabutan the shift  

**Acceptance**

- [x] Clock-in late weight = remaining/scheduled (literal 0.875 on 8h)
- [x] Absent weight 0 and not assignable
- [x] Documented in commissions epic

**Test seam:** `tests/dailyOpsNetwork.test.js`, `docs/user-stories/epic-commissions-attendance.md`
