# Epic: Operations Lead persona

**Goal:** Network-wide ops (queue ∪ BA tools, all branches) with the Planner: **no** attendance clock, **no** Daily Sheet approval.

**Home:** `/operations/queue` (Queue, all branches)

## US-OL-01 · Queue home, no Floor Board

**As** Operations Lead  
**I want** the network Queue as home and full Planner edit  
**So that** I work every branch from one board and run tasks, forms and events without inventing payroll  

**Acceptance**

- [x] Home → `/operations/queue`
- [x] No Floor link; `/operations/dashboard` → access denied (`canAccessFloorBoard` false), 2026-10-09
- [x] Planner board, calendar, forms and review load (DB `can_edit_planning()` includes Ops Lead)
- [x] Multi-branch forms without SA People
- [x] Ops Lab retired 2026-10-09: no nav link, `/operations/roadmap` redirects home

**Test seam:** `tests/operationsLead.test.js`, `tests/rolePersonaCoverage.test.js`, `scripts/check-planner-tabs.mjs`, `scripts/check-opslead-crm-notes.mjs`

---

## US-OL-04 · CRM view only, with Team Lead ticket notes

**As** Operations Lead  
**I want** to look up any customer in CRM and read the notes Team Leads leave on tickets  
**So that** I know the car and the guest before I step onto a branch floor  

**Acceptance**

- [x] CRM in nav: Directory, Smart groups, Insights; no SMS tab, "View only" notice
- [x] Directory **View** profile: no Edit profile, Message, Add vehicle; Notes tab has no Add note form
- [x] Notes tab lists **Ticket notes** (`bookings.notes` typed on the Team Lead New ticket form) with the Team Lead's name, date, branch, queue number and plate, then guest notes
- [x] RLS: read-only `customers`, `customer_notes`, `sales`, `loyalty_ledger`, `customer_memberships`; customer update affects 0 rows (migration `20261009170000_crm_readers_ops_lead_and_notes.sql`)

**Test seam:** `tests/operationsLead.test.js`, `tests/crmSmartGroups.test.js`, `scripts/check-opslead-crm-notes.mjs`

---

## US-OL-02 · Queue + POS without clock

**As** Operations Lead  
**I want** queue edit + POS + planner edit across branches  
**So that** I cover TL∪BA work network-wide  

**Acceptance**

- [x] Queue view/edit; POS access
- [x] Attendance **register** allowed; **floor clock denied** (`canUseAttendanceClock` false)
- [x] Own pay estimate on Attendance; cannot approve Daily Sheets
- [x] Denied: People, Data Center, Cars catalog, Content, Floor Board (CRM is view only, see US-OL-04)

**Test seam:** `tests/operationsLead.test.js`, `tests/permissions.test.js`, `CONTEXT.md` (Operations Lead)

---

## US-OL-03 · Detailing compensation is service-agnostic

**As** Operations Lead  
**I want** detailing splits not hard-coded to ceramic-only labels  
**So that** tint / paint maint / coating drafts share one path  

**Acceptance**

- [x] Detailing expense keys accept `detailing:` and legacy `ceramic:`
- [x] Documented in shop-day / compensation seams

**Test seam:** `tests/dailyOpsNetwork.test.js`, `tests/opsMoneyAttendanceSeam.test.js`
