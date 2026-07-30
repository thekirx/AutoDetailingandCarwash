# Admin (branch) — Deep Audit

**Role:** `admin`  
**Home:** `/operations/console`  
**Scope:** `staff_branch_assignments` / `branch_slugs` (never company-wide)  
**Denied:** Cars catalog, Reports edit, queue ticket create (`queue-new`), Planning edit, Redo lane, attendance role matrix, open new company sites  

## Done definition

1. Route / capability matrix documented  
2. Fail-closed empty scope (no silent all-branch widen)  
3. CRITICAL/HIGH Admin defects fixed + migrations applied  
4. Tests + build green  

## Contents

| File | Purpose |
|------|---------|
| `01-route-matrix.md` | Routes + capabilities |
| `02-defects-and-fixes.md` | Findings + status |
| `03-verification.md` | Evidence |

## TDD seams

1. `filterBranchesForProfile` / `pickDefaultBranchSlug` / `filterPeopleForProfile`  
2. `resolveBranchFilter` + `NO_BRANCH_SCOPE` for empty Admin  
3. `canCreateBranches` false for Admin; `allowRoute(..., 'queue-new')` false  
4. Expenses RLS `user_has_branch_access`; `create_branch` SA/ASA only  
