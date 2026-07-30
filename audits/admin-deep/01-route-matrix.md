# Admin route / capability matrix

| Area | Route key | Admin | Notes |
|------|-----------|-------|-------|
| Console | `console` | Yes | Multi-branch picker → "All my branches" |
| Floor / Queue view | `queue` | Yes | View only; no status edit without TL/SA/ASA `queue_all` |
| New ticket | `queue-new` | **No** | Requires `canEditQueueOperations` |
| POS | `pos` | Yes | Scoped branch pick when multi-assigned |
| Finance | `finance` | Yes | Write; expense branch must be in scope |
| CRM / Bookings | `crm` / board | Yes | Create form uses scoped branches |
| People | `people` | Yes | TL/Staff only; directory filtered to scope |
| Branches | `branches` | Yes | Edit assigned; **no** create/archive |
| Cars | `cars` | **No** | SA only |
| Reports | `reports` | **No** | SA / ASA grant |
| Planning edit | — | **No** | SA / ASA `planning_edit` |
| Redo lane | — | **No** | SA / ASA |
| Attendance roles | — | **No** | SA only |
| Attendance settings | — | Yes | Geofence for assigned branches |

## Branch scope rules

- `getBranchScopeList(admin)` → assigned slug list (never `null` = all)  
- Empty assignments → `NO_BRANCH_SCOPE` / empty pickers (fail-closed)  
- Multi-assign → UI may filter `all` as "All my branches" (resolved to list)  
