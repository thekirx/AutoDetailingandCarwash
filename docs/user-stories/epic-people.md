# Epic: People & staff accounts

**Goal:** Hire, edit, and grant access without inventing a second RBAC stack.

## US-PEOPLE-01 · Hire & edit staff

**As** Super Admin or ASA with people grant  
**I want** to create and edit staff profiles  
**So that** roles, branches, and clock toggles match the floor  

**Acceptance**

- [x] People directory + edit form on `/operations/people`
- [x] Temporary password via `updateStaffAccountFields`
- [x] Mobile card layout scrolls without clipping (`people-directory-cards`)

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/passwordReset.test.js`

---

## US-PEOPLE-02 · ASA permission grants

**As** Super Admin (or ASA with `rbac_edit`)  
**I want** to toggle ASA grants  
**So that** Finance / CRM / Content access is explicit  

**Acceptance**

- [x] `AssistantGrantsEditor` on People
- [x] Denied grants block `allowRoute` for CRM, Content, console, notifications
- [x] `branches_all` independent of `queue_all`

**Test seam:** `tests/assistantGrantsEditor.test.js`, `tests/leftoverUxSeam.test.js`, `tests/principalQaMatrix.test.js`

---

## US-PEOPLE-03 · Branch Admin cannot open People

**As** Branch Admin  
**I want** Crew hire deferred when I lack People access  
**So that** I do not invent staff rows outside SA/ASA  

**Acceptance**

- [x] `canManagePeople` false → Crew defers hire to People link pattern
- [x] BA `allowRoute` denies people / finance / CRM

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/permissions.test.js`
