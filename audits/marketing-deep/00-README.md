# Marketing — Deep Audit

**Role:** `marketing`  
**Home:** `/operations/crm`  
**Nav:** CRM only (Directory / Insights / SMS)  
**Scope:** `branch_slug` via `user_has_branch_access`  

## Done definition

1. Route matrix documented  
2. booking-status CRM-safe + branch-gated  
3. CRM Directory/Insights/SMS usable (RLS aligned)  
4. BusyBee GET authenticated  
5. Tests + build green  

## Contents

| File | Purpose |
|------|---------|
| `01-route-matrix.md` | Capabilities |
| `02-defects-and-fixes.md` | Findings |
| `03-verification.md` | Evidence |

## TDD seams

1. `allowRoute` / `getOperationsNav` — CRM only  
2. `canStaffUpdateBookingStatus` + `CRM_SAFE_BOOKING_STATUSES`  
3. Register account gated to `isAdmin`  
