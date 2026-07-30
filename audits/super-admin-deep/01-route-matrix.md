# SA route matrix

| Route | Gate | Page | Realtime |
|-------|------|------|----------|
| `/operations/console` | console | AdminConsolePage | No |
| `/operations/planning` | planning | PlanningBoardPage | Yes (plan_*) |
| `/operations/people` | people | PeopleManagePage | No (session push only) |
| `/operations/branches` | branches | BranchesManagePage | No |
| `/operations/cars` | cars (SA-only) | CarsCatalogPage | No (consumers subscribe) |
| `/operations/audit` | audit | AuditLogPage | No |
| `/operations/dashboard` | dashboard | OperationsDashboardPage | Yes |
| `/operations/queue` | queue | OperationsQueuePage | Yes |
| `/operations/queue/new` | queue | NewQueueTicketPage | No |
| `/operations/queue/:id` | queue | QueueTicketPage | Yes |
| `/operations/crew` | crew | CrewPage + attendance | Yes (attendance) |
| `/operations/kpi` | kpi | KpiPage | No |
| `/operations/my-tasks` | my-tasks | MyTasksPage | Yes |
| `/operations/pos` | pos | PosPage (+ services/merch tabs) | Yes |
| `/operations/finance` | finance | FinancePage | No |
| `/operations/crm` | crm | CrmPage (+ insights/sms) | No |
| `/operations/bookings` | bookings | BookingBoardPage | Yes |
| `/operations/reports` | reports | ReportsPage | No |
| `/operations/memberships` | memberships | MembershipsPage | No |

Redirects: `/operations/services`→POS services, `/operations/products`→POS merch, `/operations/sms`→CRM SMS.

BossMich: all gates true via `isSuperAdmin`.
