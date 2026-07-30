# Team Lead deep audit — verification

**Date:** 2026-07-30  
**Role:** `team_lead`

## Commands (this session)

```text
node --test tests/teamLeadScope.test.js … adminScope asaScope localCalendarDate posSale
→ exit 0 · 27 pass · 0 fail

npm run build
→ exit 0 · vite built in ~17.5s
```

## Regression (TL-C1)

1. Broke `canStaffUpdateBookingStatus` TL branch check → test **failed** (`denies Team Lead updating…`)  
2. Restored fix → **10/10** teamLeadScope pass  

## Migrations applied (remote)

| Migration | Effect |
|-----------|--------|
| `team_lead_branch_scope` | `get_crew_kpi` fail-closed; sales/complaints scoped; loyalty TL removed; customers UPDATE no TL; staff UPDATE TL=`staff` only; vehicles TL by `last_branch` |

## Deferred

- customers SELECT still role-wide for plate lookup (writes tightened)  
- Staff / Marketing deep audits next  
