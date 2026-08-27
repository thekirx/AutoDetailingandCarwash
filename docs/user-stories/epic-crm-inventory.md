# Epic: CRM, inventory & catalog

**Goal:** Customers and sellables stay distributed — CRM for people, Inventory for what POS sells.

## US-CRM-01 · Customer 360

**As** Super Admin, ASA (CRM grant), or Marketing  
**I want** customer records with notes and history  
**So that** floor and sales share one CRM  

**Acceptance**

- [x] `/operations/crm` gated by `canAccessCrm`
- [x] Marketing CRM + bookings + notifications scope
- [x] CSV / insights export helpers

**Test seam:** `tests/crmPart7.test.js`, `tests/marketingScope.test.js`, `tests/permissions.marketingSales.test.js`

---

## US-CRM-02 · Best sellers & retention

**As** leadership  
**I want** spend and retention in the filter window  
**So that** Finance Reports and CRM insights agree  

**Acceptance**

- [x] `aggregateBestSellers` with peso totals + limit
- [x] Retention buckets from customer rows
- [x] Finance Reports tab wires the same helpers

**Test seam:** `tests/crmPart7.test.js`, `tests/leftoverUxSeam.test.js`, `tests/financeData.test.js`

---

## US-INV-01 · Inventory mirrors POS tabs

**As** Super Admin or Team Lead  
**I want** Services & packages · Detailing · Merch on Inventory  
**So that** bay and multi-day catalogs stay separate  

**Acceptance**

- [x] Inventory create/list does not clone POS shell tabs
- [x] Products manage does not deep-link fake POS merch tabs
- [x] Public `/services` reads live inventory services

**Test seam:** `tests/payrollFullStack.test.js`, `tests/leftoverUxSeam.test.js`, `tests/publicCatalog.test.js`

---

## US-INV-02 · Cars catalog

**As** ops staff with catalog access  
**I want** vehicle catalog CRUD  
**So that** plate/vehicle suggest stays consistent  

**Acceptance**

- [x] `/operations/cars` modal + catalog helpers
- [x] Plate suggest / PH vehicle helpers covered

**Test seam:** `tests/carsCatalogModal.test.js`, `tests/vehicleCatalog.test.js`, `tests/plateSuggest.test.js`
