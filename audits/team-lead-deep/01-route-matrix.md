# Team Lead route / capability matrix

| Area | Route key | TL | Notes |
|------|-----------|----|-------|
| Dashboard / Floor | `dashboard` | Yes | Home |
| Queue view + edit | `queue` | Yes | Status, assign, price |
| New ticket | `queue-new` | Yes | Provision customer allowed |
| Crew | `crew` | Yes | Attendance + add staff; no Settings tab |
| KPI | `kpi` | Yes | Own branch only |
| Bookings | `bookings` | Yes | Scoped create/edit |
| My Tasks | `my-tasks` | Yes | |
| Redo lane / Mark redo | — | **No** | SA/ASA only |
| Console / POS / Finance / CRM / People / Branches / Cars / Reports / Planning / Memberships / Audit | — | **No** | |

## Branch scope

- Primary: `branch_slug`  
- Also valid: non-empty `branch_slugs` (assignments)  
- Empty → `requiresTeamLeadBranchSetup` + `NO_BRANCH_SCOPE`  
