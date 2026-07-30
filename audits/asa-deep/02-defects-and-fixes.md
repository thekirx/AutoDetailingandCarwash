# ASA defects and fixes

| ID | Pri | Defect | Status |
|----|-----|--------|--------|
| ASA-C1 | CRITICAL | `branches_all:false` + no assignments widened to all branches | **Fixed** `NO_BRANCH_SCOPE` / fail-closed |
| ASA-C2 | CRITICAL | Finance empty scope returned unscoped query | **Fixed** |
| ASA-C3 | CRITICAL | People edit always overwrote `permission_grants` | **Fixed** omit unless `rbac_edit` |
| ASA-C4 | CRITICAL | ASA assignments always cleared; no scoped ASA UI | **Fixed** keep/sync when `branches_all:false` |
| ASA-H1 | HIGH | `sync_queue_assignments` ignored `queue_all` | **Fixed** migration `asa_grant_queue_all_enforcement` |
| ASA-H2 | HIGH | provisionStaff ASA without `people` grant | **Fixed** |
| ASA-H3 | HIGH | ASA could edit/deactivate peer ASA/Admin | **Fixed** `canMutateDirectoryPerson` |
| ASA-H4 | HIGH | Console branch picker SA-only | **Fixed** `canSeeAllBranches` |
| ASA-H5 | HIGH | Crew branch pick hardcoded ASA role | **Fixed** `canSeeAllBranches` |
| ASA-H6 | HIGH | `kpi_all` dead | **Fixed** `canSeeAllKpiBranches` |
| ASA-M1 | MEDIUM | Expenses RLS still `is_admin()` (no finance_write) | Deferred (UI gated) |
| ASA-M2 | MEDIUM | `complete_pos_sale` ignores `pos` grant | Deferred |
| ASA-M3 | MEDIUM | CRM/Bookings ungated for ASA | Documented intentional |

## Correct hypothesis

Empty `getBranchScopeList` → `resolveBranchFilter` returned `null` (= all). Fail-closed sentinel `__none__` stops the leak.
