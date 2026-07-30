# Team Lead — Deep Audit

**Role:** `team_lead`  
**Home:** `/operations/dashboard`  
**Scope:** single `branch_slug` (or `branch_slugs`); fail-closed when empty  
**Core job:** Floor queue edit, new tickets, crew pool, bookings, KPI, attendance self-clock  

## Done definition

1. Route / capability matrix documented  
2. Service-role APIs branch-gated (booking-status)  
3. New Ticket provision includes TL  
4. RLS/RPC fail-closed for sales, KPI, staff writes  
5. Tests + build green  

## Contents

| File | Purpose |
|------|---------|
| `01-route-matrix.md` | Routes + capabilities |
| `02-defects-and-fixes.md` | Findings + status |
| `03-verification.md` | Evidence |

## TDD seams

1. `allowRoute` / `getTeamLeadDock` capability matrix  
2. `canStaffUpdateBookingStatus` (booking-status API)  
3. `QUEUE_PROVISION_ROLES` includes `team_lead`  
4. `hasValidTeamLeadBranch` / `requiresTeamLeadBranchSetup`  
5. `NO_BRANCH_SCOPE` for empty TL  
