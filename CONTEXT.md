# Hakum Auto Care — domain glossary

Short vocabulary for audits and architecture reviews. Expand as seams deepen.

| Term | Meaning |
|------|---------|
| Floor | Live queue board + ticket lifecycle (waiting → … → payment) |
| Visit group | Multi-service tickets sharing one `queue_number` / `visit_group_id` |
| Queue allocator | `queue_number_counters` + `assign_daily_queue_number` (atomic per branch/day) |
| Handoff | Queue → POS payment transfer (`pos_handoffs` / sale) |
| ASA | `assistant_super_admin` with `permission_grants` toggles |
| Branch scope | `getBranchScopeList` / `user_has_branch_access` — null = all sites |
| Public queue | DEFINER views projecting only branch/queue_number/status |
| Data Center | Super Admin only export/import/purge |
| Loyalty program | Singleton `loyalty_program_settings` — SA kill-switches for stamps / points / memberships |
| Stamp earn mode | `all_weighted` or `pay_categories` (e.g. wash-only carwash stamps) |
| Service loyalty weight | `services.loyalty_weight` × qty → stamp delta (0 = never earns) |
| Membership multiplier | Tier `loyalty_multiplier` on spend points; optional on stamps too |
| Membership POS pricing | Tier `discount_percent` + `included_services` applied on catalog POS lines (queue handoffs keep floor price) |

## Intentional denorm

Booking rows snapshot customer/vehicle fields at ticket time so floor history does not drift when CRM updates later.
