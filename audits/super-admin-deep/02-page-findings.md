# SA page findings (summary)

Operational pages use **live Supabase** data. No fabricated sales/queue/customer rows found.

## Console / admin

| Page | Data | Gaps |
|------|------|------|
| Console | daily_sales_summary, expenses, products, bookings, staff | Silent `errors[]`; stock/staff ignore branch filter; profit window mismatch |
| People | staff_profiles + provision API | No email/password edit UI; ASA promotion leaves branch assignments; “realtime” copy overclaim |
| Branches | branches RPCs | Active without map pin allowed |
| Cars | vehicle_catalog | Floor falls back to static PH list only when DB empty (documented) |
| Audit | audit_logs | Actor id/role only; no filters |

## Floor

| Page | Data | Gaps |
|------|------|------|
| Dashboard | operations snapshot | Date range only filters events/handoffs; no export |
| Queue / Ticket | queue board + RPC assign | Action error unmounted whole ticket (CRITICAL) |
| New ticket | createQueueTicket | Multi-service price override ignored |
| Crew | pool + attendance | Temp password type=text |
| My Tasks | assignments + plan cards | Queue: acknowledge only |
| POS | services/products/sales/handoffs | Link2 crash; UTC today; handoff UUID as service_id |
| Finance | sales + expenses | NaN risk on unit cost |
| CRM/SMS | customers + BusyBee | Templates unused on send |
| Bookings | bookings | Missing floor statuses in columns |
| Planning | plan_boards | First board only |
| Reports | sales/expenses/… | Unscoped line items / crew / complaints |
| KPI | get_crew_kpi | Array branch scope wrong; completed_today=0 |
| Memberships | adminApi tiers | OK |

## Hardcoded (acceptable)

Payment methods, booking column labels, SMS message types, planning fallback labels, DEV demo chips.

## Hardcoded (problematic)

- Demo passwords in client module imported by LoginPage (prod bundle risk)
- KPI `completed_today: 0` after RPC map
- Reports aggregates that look scoped but are not
