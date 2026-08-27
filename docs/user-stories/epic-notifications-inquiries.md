# Epic: Notifications, inquiries & reviews

**Goal:** Inboxes and outbound messages stay role-gated; status writes match CHECK constraints.

## US-NOTIF-01 · Notifications hub

**As** Sales, Marketing, or SA/ASA with grants  
**I want** `/operations/notifications`  
**So that** booking / planner / shift messages land in one place  

**Acceptance**

- [x] Route gated by `canAccessNotifications`
- [x] ASA without grant denied
- [x] Template / SMS toggles covered

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/notificationTemplates.test.js`, `tests/smsNotificationsToggle.test.js`

---

## US-INQ-01 · Inquiries inbox

**As** ASA or Super Admin  
**I want** partnership, contact, and complaints statuses  
**So that** public forms progress to archived  

**Acceptance**

- [x] Partnership status actions write CHECK values
- [x] Contact + complaints status updates from Inquiries page
- [x] Public inquiry API / form seams

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/publicInquiry.test.js`, `tests/partnershipInquiry.test.js`

---

## US-REV-01 · Reviews & Failed QA

**As** Team Lead / SA / ASA  
**I want** to mark Failed QA and see completed-visit scores  
**So that** quality stays visible without Sales inventing statuses  

**Acceptance**

- [x] TL/SA/ASA can mark Failed QA; sales cannot
- [x] Reviews access for BA+
- [x] Service reviews RLS covered

**Test seam:** `tests/principalQaFlows.test.js`, `tests/serviceReviews.test.js`, `tests/serviceReviewsRls.test.js`
