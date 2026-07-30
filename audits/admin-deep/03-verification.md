# Admin deep audit — verification

**Date:** 2026-07-30  
**Role:** `admin`

## Commands (this session)

```text
node --test tests/adminScope.test.js tests/asaScope.test.js tests/localCalendarDate.test.js tests/posSale.test.js
→ exit 0 · 17 pass · 0 fail

npm run build
→ exit 0 · vite built in ~17.6s
```

## Migrations applied (remote)

| Migration | Effect |
|-----------|--------|
| `admin_expenses_branch_scope` | Expenses FOR ALL: SA/ASA or (`is_admin()` ∧ `user_has_branch_access(branch)`) |
| `admin_branch_and_staff_scope` | `create_branch` SA/ASA only; `update_branch` Admin needs access; `staff_profiles` RLS scoped |

Confirmed via `pg_policy` on `expenses` / `staff_profiles`.

## Seams covered by tests

- Admin matrix (no cars/reports/queue-new/planning-edit/redo)  
- Multi-branch never company-wide  
- Fail-closed empty pickers / people list  
- `canCreateBranches` false for Admin  

## Deferred / next roles

- TL deep audit  
- Staff / Marketing deep audits  
- Provision API still service-role — rely on UI + caller checks (same as ASA note)  
