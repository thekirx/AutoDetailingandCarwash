# Staff — Deep Audit

**Role:** `staff`  
**Home:** `/operations/my-tasks`  
**Scope:** Own assignments + self attendance at `branch_slug`  
**Nav:** My Tasks only  

## Done definition

1. Route matrix documented  
2. Vehicles/transactions RLS hardened  
3. Assignment updates via RPC only (no booking_id escalate)  
4. My Tasks: Acknowledge + Mark done + Time clock  
5. Tests + build green  

## Contents

| File | Purpose |
|------|---------|
| `01-route-matrix.md` | Capabilities |
| `02-defects-and-fixes.md` | Findings |
| `03-verification.md` | Evidence |

## TDD seams

1. `allowRoute` / `getOperationsNav` — My Tasks only  
2. `allowedStaffAssignmentPatch` / `allowedStaffPlanAssigneePatch`  
3. RPCs `acknowledge_queue_assignment` / `complete_queue_assignment`  
