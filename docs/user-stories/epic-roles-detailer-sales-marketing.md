# Epic: Detailer, Sales & Marketing roles

**Goal:** Non-bay roles get the right boards without Daily Sheet approval or People inventing new engines.

## US-DET-01 · Detailer floor

**As** a detailer  
**I want** Bookings + Attendance + My Tasks  
**So that** I work jobs I am assigned and my commission lands on the Daily Sheet  

**Acceptance**

- [x] Home → `/operations/bookings`
- [x] Dock: Bookings + Attendance + Tasks (`getDetailerDock`)
- [x] `canAccessBookingBoard` for detailer
- [x] Own pay estimate on Attendance (My Pay retired 2026-10-01)
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

## US-SALES-02 · Sales watches the Queue and reads CRM

**As** sales  
**I want** the Queue for every branch (with a branch filter) and CRM lookups  
**So that** I can answer customers about any car without changing wash work or customer records  

**Acceptance**

- [x] Queue + CRM in Sales nav and dock; Bookings stays home
- [x] Queue shows all branches; branch filter narrows to one
- [x] Wash tickets are view only; detailing tickets open the Bookings editor (status, service, price) and closing returns to Queue
- [x] No New ticket; `/operations/queue/new`, Floor Board and KPI stay refused
- [x] CRM view only: no edit customer, add vehicle, message, register, or SMS tab
- [x] `/api/booking-status` and `bookings` RLS refuse Sales writes on non-detailing bookings

**Test seam:** `tests/salesRole.test.js`, `tests/bookingStatusRoles.test.js`, `scripts/check-sales-queue-crm.mjs` (browser), migration `20261009160000_sales_detailing_only_writes.sql`

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
