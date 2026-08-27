# Epic: Detailer, Sales & Marketing roles

**Goal:** Non-bay roles get the right boards without Payroll or People inventing new engines.

## US-DET-01 · Detailer floor

**As** a detailer  
**I want** Bookings + Attendance + My Tasks + My Pay  
**So that** I work jobs I am assigned and see posted commission  

**Acceptance**

- [x] Home → `/operations/bookings`
- [x] Dock: Bookings + Attendance + Tasks (`getDetailerDock`)
- [x] `canAccessBookingBoard` for detailer
- [x] My Pay in detailer overflow when `canViewOwnPay`
- [x] Assigned detailing commission pays `assigned_staff_id` (booking + walk-in)
- [x] Denied: POS, Finance, People, queue-new

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/dailyOpsNetwork.test.js`, `tests/permissions.test.js`, `tests/principalQaMatrix.test.js`, `tests/rolePersonaCoverage.test.js`

---

## US-SALES-01 · Sales home is Bookings

**As** sales  
**I want** home → bookings and all-branch detailing  
**So that** I do not land on wash queue  

**Acceptance**

- [x] Home / sales redirect to bookings
- [x] All-branch notifications + status access
- [x] Detailing pipeline statuses

**Test seam:** `tests/principalQaMatrix.test.js`, `tests/salesAllBranchesNotifications.test.js`, `tests/salesRole.test.js`

---

## US-MKT-01 · Marketing scope

**As** marketing  
**I want** CRM, Content, Bookings, notifications — not Finance pay tools  
**So that** I run demand without touching payroll  

**Acceptance**

- [x] Marketing nav / more menu includes CRM + content paths
- [x] `canAccessMarketing` / `canManageSiteContent` gates
- [x] Content blocks + public home content seams

**Test seam:** `tests/marketingScope.test.js`, `tests/contentBlocks.test.js`, `tests/leftoverUxSeam.test.js`
