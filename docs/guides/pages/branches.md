# Branches

**Route:** `/operations/branches`  
**Shell:** Command

## Purpose
Branch CRUD.

## Components
DataTable, Dialog form.

## Layout
- **New branch** button in the list header opens the create form in a dialog (map pin picker inside). The page stays a full-width list.
- Search (name, slug, code, address) + status chips with counts (Current / Active / Coming soon / Inactive / Archived / All; default Current = not archived) filter the table (`src/lib/branchListFilter.js`).

## CRUD create pattern (all ops pages)
Create forms are never always-open on the page: a header button opens a `Dialog` (`max-h-[90svh] overflow-y-auto`), the dialog closes on success, and touch targets stay ≥ 44px below `xl`. Seam: `tests/crudCreateModals.test.js` lists every converted page (Branches, Products, Cars, SMS templates, Memberships, Planning events, Services, Finance vendors / categories / corporate / quotes / expense reports, People roles / temp TL, Notification rules / kinds).
