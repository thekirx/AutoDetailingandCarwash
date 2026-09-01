# Epic: Customer portal & public queue

**Goal:** Customers see their garage and live queue without staff session APIs.

## US-CUST-01 · Account lifecycle

**As** a customer  
**I want** phone sign-in / signup / claim  
**So that** visit history stays on one `customers.id`  

**Acceptance**

- [x] Intent router in `customerAccountLifecycle`
- [x] First-account wizard (phone → name/plate → birthday → password)
- [x] Team Lead provision autofill + `must_set_password`

**Test seam:** `tests/customerAccountLifecycle.test.js`, `tests/customerOnboarding.test.js`, `tests/customerAuth.test.js`

---

## US-CUST-02 · Garage & history

**As** a signed-in customer  
**I want** vehicles and past visits  
**So that** I recognize my plates at the bay  

**Acceptance**

- [x] Customer account frame + garage helpers
- [x] History / account nav coverage

**Test seam:** `tests/customerGarage.test.js`, `tests/customerHistory.test.js`, `tests/customerAccountNav.test.js`

---

## US-CUST-03 · Public / kiosk queue

**As** a guest in the lobby  
**I want** public queue status by branch  
**So that** I see progress without logging in  

**Acceptance**

- [x] Public queue page / kiosk path
- [x] DEFINER views project only safe columns (branch, queue_number, status)

**Test seam:** `tests/publicQueueKiosk.test.js`, `tests/liveQueuePath.test.js`, `tests/customerScope.test.js`

---

## US-CUST-04 · Never lands in ops

**As** a customer  
**I want** `/account` as home  
**So that** I never open staff Payroll / People / POS  

**Acceptance**

- [x] `resolveAppHome({ role: 'customer' })` → `/account`
- [x] Account tabs: Home, Blog, Events, Queue
- [x] Ops `/operations/*` denied for customer profile

**Test seam:** `tests/appShell.test.js`, `tests/customerAppFrame.test.js`, `tests/rolePersonaCoverage.test.js`
