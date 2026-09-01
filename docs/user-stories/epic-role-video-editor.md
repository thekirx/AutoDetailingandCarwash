# Epic: Video Editor persona

**Goal:** Calendar + assigned tasks + posted pay — no bay money tools.

**Home:** `/operations/planning?tab=calendar`

## US-VE-01 · Calendar-first shell

**As** a video editor  
**I want** Planner calendar and My Tasks as my dock  
**So that** shoot / edit work is scheduled without queue noise  

**Acceptance**

- [x] Home → `/operations/planning?tab=calendar`
- [x] Dock: Calendar + Tasks (`getVideoEditorDock`)
- [x] More: Pay when `canViewOwnPay`
- [x] Denied: queue, POS, Finance, CRM, Bookings, People

**Test seam:** `tests/principalQaMatrix.test.js`, `tests/leftoverUxSeam.test.js`, `tests/rolePersonaCoverage.test.js`

---

## US-VE-02 · Assigned work + proof

**As** a video editor  
**I want** only cards assigned to me  
**So that** I submit proof into Review without editing the whole board  

**Acceptance**

- [x] `canViewAssignedTasks` / My Tasks path
- [x] Planner proof transitions for assignees
- [x] Attendance gate available (clock when enabled) without Ops Lead-style network tools

**Test seam:** `tests/plannerProofTransitions.test.js`, `tests/planningUi.test.js`, `tests/attendanceRoles.test.js`
