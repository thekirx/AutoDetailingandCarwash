# ASA grant → capability matrix

| Grant | Default | Effect |
|-------|---------|--------|
| *(role)* | — | Console, Planning view, Queue/Crew/KPI view, CRM, Bookings, My Tasks, Redo |
| `pos` | true | `/operations/pos` |
| `finance_view` | true | Finance read |
| `finance_write` | false | Finance mutations |
| `reports` | true | Reports |
| `planning_edit` | false | Planning write (+ RLS) |
| `people` | true | People + provision API |
| `branches` | true | Branches CRUD |
| `branches_all` | true | All-branch data scope; false → assignments required |
| `services_merch` | true | POS manage tabs (or via `pos`) |
| `queue_all` | true | Queue edit + RPC assign (enforced) |
| `kpi_all` | true | KPI all-sites filter |
| `audit` | true | Audit log |
| `memberships` | true | Memberships |
| `rbac_edit` | false | Edit other ASA grants |

**Denied always:** Cars, create Admin/ASA, attendance role config, loyalty score edits (SA).
