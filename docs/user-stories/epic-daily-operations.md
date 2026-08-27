# Epic: Daily floor operations

**Goal:** Crew clocks in, Team Lead runs wash queue, Sales runs detailing bookings — all scoped to branch and attendance.

## US-DOPS-01 · Crew clock-in

**As** crew or team lead  
**I want** to clock attendance at my branch  
**So that** wash-pool pay only includes present roster  

**Acceptance**

- [x] `attendance_enabled` gate blocks clock when off (`canClockAttendance`)
- [x] Geofence enforced when `geofence_enabled` on profile
- [x] Super Admin does not use floor clock (`canUseAttendanceClock` false)
- [x] Present / late statuses are assignable on queue (`isAssignableAttendanceStatus`)

**Test seam:** `tests/attendanceSystem.test.js`, `tests/dailyOpsWorkflow.test.js`

---

## US-DOPS-02 · Team Lead queue tickets (carwash)

**As** team lead  
**I want** to add and advance wash queue tickets  
**So that** customers flow waiting → payment at POS  

**Acceptance**

- [x] TL can open `/operations/queue` and create tickets
- [x] Queue is wash-only; detailing stays on Bookings
- [x] Handoff to POS loads `visit_group_id` + `queue_number`
- [x] Merch add keeps handoff; walk-in service clears handoff

**Test seam:** `tests/queueLogic.test.js`, `tests/posWorkflowSeam.test.js`, `tests/leftoverUxSeam.test.js`, `tests/userStoriesCoverage.test.js`

---

## US-DOPS-03 · Sales detailing bookings

**As** sales  
**I want** to manage the detailing pipeline  
**So that** bay work is tracked separately from same-day wash queue  

**Acceptance**

- [x] Pipeline statuses: pending → … → completed (`DETAILING_BOARD_STATUSES`)
- [x] Sales scoped to all branches; updates respect `bookingStatusAccess`
- [x] Paid detailing lands in POS with correct bucket (coating vs generic detailing)

**Test seam:** `tests/principalQaFlows.test.js`, `tests/salesAllBranchesNotifications.test.js`, `tests/dailyOpsWorkflow.test.js`

---

## US-DOPS-04 · Branch Admin POS checkout

**As** branch admin  
**I want** to pay queue tickets and walk-in sales  
**So that** paid POS is the single source of truth for day revenue  

**Acceptance**

- [x] Checkout blocked when service line missing `service_id`
- [x] Payment methods: cash, GCash, card
- [x] Ceramic/detailing sales generate compensation draft keys (not posted pay)
- [x] Approved cash advances visible on close, not POS tabs

**Test seam:** `tests/posWorkflowSeam.test.js`, `tests/payrollFullStack.test.js`, `tests/principalQaFlows.test.js`
