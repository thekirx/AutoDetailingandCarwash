# Admin defects and fixes

| ID | Pri | Defect | Status |
|----|-----|--------|--------|
| ADM-C1 | CRITICAL | Expenses RLS `is_admin()` company-wide; Finance forms listed all branches | **Fixed** migration `admin_expenses_branch_scope` + `writableBranches` |
| ADM-C2 | CRITICAL | `staff_profiles` write/read via bare `is_admin()` | **Fixed** migration `admin_branch_and_staff_scope` + `filterPeopleForProfile` |
| ADM-C3 | CRITICAL | Attendance empty scope fell through to `rows[0]` | **Fixed** `pickDefaultBranchSlug` / scoped fetch |
| ADM-C4 | CRITICAL | Bookings create listed all branches / defaulted `branches[0]` | **Fixed** `filterBranchesForProfile` + scoped default |
| ADM-H1 | HIGH | Console + POS first-slug only (ignored multi-branch Admin) | **Fixed** multi picker + scoped options |
| ADM-H2 | HIGH | `create_branch` any `is_admin()` site | **Fixed** SA/ASA `branches` grant only; Admin UI create/archive hidden |
| ADM-H3 | HIGH | Unscoped People directory | **Fixed** client filter + RLS select scope |
| ADM-M1 | MEDIUM | `/queue/new` gated by queue **view** | **Fixed** `allowRoute('queue-new')` → `canEditQueueOperations` |
| ADM-M2 | MEDIUM | Floor eyebrow always "Team Lead" | **Fixed** Branch Admin Dashboard label |
| ADM-M3 | MEDIUM | `update_branch` any admin site | **Fixed** `user_has_branch_access` for role `admin` |

## Correct hypothesis

Branch Admin shared `is_admin()` with Super Admin for RLS and RPCs, so UI-only scoping leaked. Fail-closed helpers + role-aware SQL (`current_user_role() = 'admin'` + `user_has_branch_access`) close the gap.
