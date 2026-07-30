# Staff deep audit — verification

**Date:** 2026-07-30  
**Role:** `staff`

## Commands (this session)

```text
node scripts/staff-regression-check.mjs
→ RED exit 1 (pass 6 | fail 1) · GREEN exit 0 (pass 7 | fail 0)

node --test tests/staffScope.test.js tests/teamLeadScope.test.js tests/adminScope.test.js tests/asaScope.test.js
→ exit 0 · 29 pass · 0 fail

npm run build
→ exit 0 · vite built in ~24.5s
```

## Migration applied (remote)

`staff_scope_harden` — vehicles/transactions harden; assignment RPCs; plan assignee trigger; active-only booking helper.

## Deferred

- Server-side geofence RPC (STF-H1)  
- Marketing deep audit next  
