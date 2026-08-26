# Migration ledger — repo vs live

**Live project:** `lybxhpzzqqyqswvuwpxv`  
**Checked:** 2026-08-20

## How migrations are named

| Source | Pattern | Example |
|--------|---------|---------|
| Git repo | `YYYYMMDDHHMMSS_descriptive_name.sql` (often synthetic future dates) | `20260820150000_catalog_copy_seed.sql` |
| Live Supabase | Actual apply timestamp from `schema_migrations` | `20260820055834_contact_status_asa_grants` |

Same **name** suffix usually matches; **version** differs. Trust live `schema_migrations.name` for what ran.

## Audit migrations (this effort)

| Repo file | Live version | Live name | Status |
|-----------|--------------|-----------|--------|
| `20260820120000_leftover_hot_path.sql` | `20260820052544` | `leftover_hot_path` | Applied |
| `20260820130000_leftover_gate_rpc.sql` | `20260820054842` | `leftover_gate_rpc` | Applied |
| `20260820140000_contact_status_asa_grants.sql` | `20260820055834` | `contact_status_asa_grants` | Applied |
| `20260820150000_catalog_copy_seed.sql` | `20260820063237` | `catalog_copy_seed` | Applied |
| `20260820160000_public_inquiry_api_geofence.sql` | `20260820064044` | `public_inquiry_api_geofence` | Applied |
| `20260820170000_branch_operating_hours_table.sql` | `20260820070315` | `branch_operating_hours_table` | Applied |
| `20260820180000_homepage_wash_sku_seed.sql` | `20260820070916` | `homepage_wash_sku_seed` | Applied |
| `20260820190000_run_payroll_advisory_lock.sql` | `20260820072056` | `run_payroll_advisory_lock` | Applied |
| `20260820200000_staff_login_email_backfill.sql` | `20260820074343` | `staff_login_email_backfill` | Applied |
| `20260820210000_revoke_geofence_rpc.sql` | `20260820075224` | `revoke_geofence_rpc` | Applied |
| `20260820220000_hot_path_fk_indexes.sql` | `20260820083107` | `hot_path_fk_indexes` | Applied |
| `20260820230000_rls_auth_uid_initplan.sql` | `20260820083213` | `rls_auth_uid_initplan` | Applied |
| `20260820240000_rls_initplan_blogs_notifications.sql` | `20260820092531` | `rls_initplan_blogs_notifications` | Applied |
| `20260820250000_remaining_fk_indexes.sql` | `20260820092625` | `remaining_fk_indexes` | Applied |
| `20260820260000_drop_redundant_indexes.sql` | `20260820093756` | `drop_redundant_indexes` | Applied |
| `20260820270000_asa_content_notifications_rls.sql` | `20260820093901` | `asa_content_notifications_rls` | Applied |
| `20260820280000_events_rls_and_permissive_merge.sql` | `20260820100833` | `events_rls_and_permissive_merge` | Applied |
| `20260820290000_bookings_customers_vehicles_rls_merge.sql` | `20260820104531` | `bookings_customers_vehicles_rls_merge` | Applied |
| `20260820300000_planner_attendance_branches_rls_merge.sql` | `20260820105543` | `planner_attendance_branches_rls_merge` | Applied |
| `20260820310000_finance_loyalty_catalog_rls_merge.sql` | `20260820110153` + `20260820110238` | `finance_loyalty_catalog_rls_merge` + `finance_catalog_ops_rls_merge` | Applied (split live apply; one repo file) |
| `20260821010000_shift_close_reports.sql` | `20260820164821` + `20260820164911` | `shift_close_reports` + `shift_close_rpcs` | Applied |
| `20260821020000_payroll_custom_packages.sql` | `20260820165613` + `20260820165704` | `payroll_custom_packages` + `run_payroll_custom_adj` | Applied |
| `20260821030000_customer_notes.sql` | `20260820170016` | `customer_notes` | Applied |
| `20260821040000_role_definitions.sql` | `20260820170309` | `role_definitions` | Applied |
| `20260821050000_expense_reports.sql` | `20260820170405` + `20260820170452` | `expense_reports_tables` + `expense_report_rpcs` | Applied |
| `20260821100000_staff_pay_packages_branch.sql` | `20260821020832` | `staff_pay_packages_branch` | Applied |
| `20260821110000_submit_expense_report_branch_acl.sql` | `20260821021022` | `submit_expense_report_branch_acl` | Applied |

## Related live migrations (pre-audit, referenced in tests)

| Live name | Purpose |
|-----------|---------|
| `complete_pos_sale_settle_txn` | Atomic POS settle |
| `complete_pos_sale_lock_handoff` | Handoff row lock |
| `pos_handoff_one_sale` | One sale per handoff |
| `concurrency_hot_path` | Finance ASA RLS + hot path |
| `run_payroll_function` / `payroll_runs_rpc` | Payroll confirm |
| `partnership_inquiries` | Inquiries inbox RLS |
| `branch_operating_hours` (`20260819185520`) | **Orphan name** — no table created; superseded by `branch_operating_hours_table` |

## Repo duplicates (same date prefix, different files)

| Prefix | Files |
|--------|-------|
| `20260819140000` | `concurrency_hot_path.sql`, `content_external_link_and_tba.sql` |

Live applied both with distinct timestamps — safe, but confusing in git. Do not rename without coordinating live history.

## Hygiene (documented, not renamed)

- **O-10:** Repo timestamps are synthetic; live versions are apply-time. Always match on **name** suffix.
- **O-11:** Two files share prefix `20260819140000_` — leave as-is; live has distinct versions.
- **O-14:** `branch_operating_hours` (`20260819185520`) is an orphan name; do not drop from `schema_migrations` without ops approval. Use `branch_operating_hours_table` for the real object.


```sql
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 30;
```

## Apply new repo migration to live

Use Supabase MCP `apply_migration` with the SQL body from the repo file, or `supabase db push` against linked project.
