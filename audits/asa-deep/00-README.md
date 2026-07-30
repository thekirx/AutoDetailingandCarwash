# Assistant Super Admin — Deep Audit

**Role:** `assistant_super_admin`  
**Home:** `/operations/console`  
**Scope:** `branches_all` grant (default true) or `staff_branch_assignments`  
**Cars / create Admin+ASA / attendance roles:** Super Admin only  

## Done definition

1. Grant → route matrix documented  
2. Fail-closed empty scope (no silent all-branch widen)  
3. CRITICAL/HIGH ASA defects fixed + migration applied  
4. Tests + build green  

## Contents

| File | Purpose |
|------|---------|
| `01-grant-matrix.md` | Grants → routes |
| `02-defects-and-fixes.md` | Findings + status |
| `03-verification.md` | Evidence |

## TDD seams

1. `resolveBranchFilter` / `getBranchScope` / `NO_BRANCH_SCOPE` — empty assignments fail-closed  
2. `hasGrant` / `canSeeAllKpiBranches` — kpi_all independent  
3. People save omits `permission_grants` without `rbac_edit`  
4. `asa_has_grant('queue_all')` on `sync_queue_assignments`  
