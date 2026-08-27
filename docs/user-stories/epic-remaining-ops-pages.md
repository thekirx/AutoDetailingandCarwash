# Epic: Remaining ops pages (KPI, History, Memberships, Settings, Audit, Content)

**Goal:** Every Command / overflow surface has a documented story tied to an existing seam — no orphan routes.

## US-HIST-01 · Visit history

**As** Sales, Marketing, Team Lead, or Branch Admin  
**I want** `/operations/history`  
**So that** I can look up past visits without opening CRM  

**Acceptance**

- [x] Nav / dock includes History for Sales, Marketing, BA
- [x] Route key `history` via `opsRouteKeyFromPath`
- [x] Sales dock lists History beside Bookings

**Test seam:** `tests/customerHistory.test.js`, `tests/salesRole.test.js`, `tests/marketingScope.test.js`, `tests/leftoverUxSeam.test.js`

---

## US-KPI-01 · Branch KPI board

**As** Team Lead or queue viewer  
**I want** `/operations/kpi`  
**So that** bay volume is visible without Finance P&L  

**Acceptance**

- [x] TL More menu includes KPI when queue ops visible
- [x] SA nav can open KPI
- [x] BA Command does not invent fake pay KPIs as official payroll

**Test seam:** `tests/permissions.test.js`, `tests/teamLeadScope.test.js` / `getTeamLeadMore`, `tests/leftoverUxSeam.test.js`

---

## US-MEM-01 · Memberships & loyalty

**As** Super Admin (or ASA with memberships grant)  
**I want** `/operations/memberships`  
**So that** stamps / points / tiers stay kill-switchable  

**Acceptance**

- [x] `loyalty_program_settings` / memberships helpers
- [x] BA denied `memberships` route by default
- [x] POS can apply membership discount when enabled

**Test seam:** `tests/loyaltyLogic.test.js`, `tests/adminScope.test.js`, `tests/posSale.test.js`, `tests/opsValidation.test.js`

---

## US-SET-01 · Settings hub

**As** Super Admin / ASA  
**I want** `/operations/settings` with thin modules  
**So that** POS field config and Payroll rules stay separate  

**Acceptance**

- [x] Settings hub links `settings/payroll` without posting compensation from the hub
- [x] POS settings module ships
- [x] Company Command group includes Settings

**Test seam:** `tests/userStoriesCoverage.test.js`, `tests/posPayrollSettings.test.js`, `tests/commandCategories.test.js`

---

## US-AUDIT-01 · Audit log

**As** Branch Admin or Super Admin  
**I want** `/operations/audit`  
**So that** POS / sale actions are reviewable  

**Acceptance**

- [x] BA allowRoute includes `audit`
- [x] Audit path in BA shell list

**Test seam:** `tests/branchAdminShell.test.js`, `tests/adminScope.test.js`

---

## US-CONTENT-01 · Content & broadcast

**As** Marketing or SA/ASA with content grant  
**I want** `/operations/content` and broadcast under notifications  
**So that** public site blocks and blasts stay role-gated  

**Acceptance**

- [x] SA nav includes Content
- [x] Broadcast routes as notifications key
- [x] Content blocks seam

**Test seam:** `tests/contentBlocks.test.js`, `tests/leftoverUxSeam.test.js`, `tests/authRedirect.test.js`, `tests/smsNotificationsToggle.test.js`
