# Graphify DB full dump (live)

Verified 2026-09-15 via Supabase MCP (`lybxhpzzqqyqswvuwpxv`). Counts: **74** RPCs, **25** user triggers, **146** FKs, **245** RLS policies.

## Enums

- `booking_status`: pending, confirmed, in_progress, completed, cancelled, no_show, waiting, final_checking, for_payment, redo, for_releasing
- `profile_role`: customer, staff, admin, team_lead, cashier (legacy), BossMich, marketing, sales, assistant_super_admin, detailer, video_editor, investor, operations_lead
- `transaction_type`: sale, refund, expense, adjustment

## Public RPCs

| Function | Args | Returns | Security |
|---|---|---|---|
| `acknowledge_queue_assignment` | `p_assignment_id uuid` | `queue_assignments` | DEFINER |
| `admin_override_queue_status` | `input_booking_id uuid, input_next_status text, input_reason text` | `jsonb` | DEFINER |
| `archive_branch` | `input_branch_slug text` | `branches` | DEFINER |
| `archive_instead_of_delete` | `—` | `trigger` | DEFINER |
| `asa_has_grant` | `grant_key text` | `boolean` | DEFINER |
| `assert_pos_sale_integrity` | `payload jsonb` | `void` | DEFINER |
| `assign_daily_queue_number` | `p_branch text, p_queue_date date` | `integer` | DEFINER |
| `assign_persistent_queue_number` | `p_branch text` | `integer` | DEFINER |
| `award_loyalty_stamps` | `input_customer_id uuid, input_service_id uuid, input_quantity integer` | `integer` | DEFINER |
| `can_access_ops_roadmap` | `—` | `boolean` | DEFINER |
| `can_edit_planning` | `—` | `boolean` | INVOKER |
| `can_edit_queue_branch` | `input_branch text` | `boolean` | INVOKER |
| `can_manage_branch` | `target_branch text` | `boolean` | DEFINER |
| `can_read_queue_assignment` | `p_staff_id uuid, p_booking_id uuid` | `boolean` | DEFINER |
| `can_view_queue_branch` | `input_branch text` | `boolean` | INVOKER |
| `claim_birthday_perk` | `p_customer_id uuid, p_sale_id uuid` | `jsonb` | DEFINER |
| `complete_payment` | `input_booking_id uuid, input_payment_method text, input_reference_number text, input_payment_notes text` | `jsonb` | DEFINER |
| `complete_pos_sale` | `payload jsonb` | `jsonb` | DEFINER |
| `complete_pos_sale_impl` | `payload jsonb` | `jsonb` | DEFINER |
| `complete_queue_assignment` | `p_assignment_id uuid` | `queue_assignments` | DEFINER |
| `create_branch` | `input_name, input_slug, input_code, input_address, input_latitude, input_longitude, input_coming_soon, input_is_active` | `branches` | DEFINER |
| `create_completion_sms_event` | `—` | `trigger` | INVOKER |
| `current_user_branch` | `—` | `text` | DEFINER |
| `current_user_branch_slug` | `—` | `text` | INVOKER |
| `current_user_branch_slugs` | `—` | `text[]` | DEFINER |
| `current_user_role` | `—` | `text` | DEFINER |
| `enforce_staff_attendance_geofence` | `—` | `trigger` | DEFINER |
| `get_branch_throughput` | `input_start_date, input_end_date, input_branch_slug` | `TABLE` | DEFINER |
| `get_crew_kpi` | `input_start_date, input_end_date, input_branch_slug` | `TABLE` | DEFINER |
| `get_my_queue_work` | `—` | `TABLE` | DEFINER |
| `get_public_ops_form` | `p_slug text` | `jsonb` | DEFINER |
| `guard_branch_stock_ba_increase` | `—` | `trigger` | INVOKER |
| `guard_plan_card_assignee_self_update` | `—` | `trigger` | DEFINER |
| `handle_queue_timestamps` | `—` | `trigger` | INVOKER |
| `haversine_meters` | `lat1, lng1, lat2, lng2` | `float8` | INVOKER |
| `is_admin` | `—` | `boolean` | INVOKER |
| `is_assistant_super_admin` | `—` | `boolean` | INVOKER |
| `is_inquiry_reader` | `—` | `boolean` | DEFINER |
| `is_staff` | `—` | `boolean` | DEFINER |
| `is_super_admin` | `—` | `boolean` | INVOKER |
| `is_team_lead` | `—` | `boolean` | INVOKER |
| `link_booking_to_masterlist` | `—` | `trigger` | INVOKER |
| `list_birthday_customers` | `p_month, p_day` | `TABLE` | DEFINER |
| `log_queue_status_change` | `—` | `trigger` | INVOKER |
| `normalize_plate_number` | `input_plate text` | `text` | INVOKER |
| `ops_lab_audit_catalog_trg` | `—` | `trigger` | DEFINER |
| `ops_lab_audit_items_trg` | `—` | `trigger` | DEFINER |
| `ops_lab_write_audit` | `p_action, p_entity_type, p_entity_id, p_summary, p_meta jsonb` | `void` | DEFINER |
| `reactivate_branch` | `input_branch_slug text` | `branches` | DEFINER |
| `redeem_pos_loyalty_awards` | `payload jsonb` | `void` | DEFINER |
| `resolve_ops_lab_notify_user_ids` | `exclude_user uuid` | `uuid[]` | DEFINER |
| `review_expense_report` | `payload jsonb` | `jsonb` | DEFINER |
| `review_shift_close` | `payload jsonb` | `jsonb` | DEFINER |
| `run_payroll` | `payload jsonb` | `jsonb` | DEFINER |
| `send_queue_ticket_to_payment` | `input_booking_id uuid` | `jsonb` | DEFINER |
| `set_branch_hours` | `input_branch_slug, input_opens_at, input_closes_at, input_closed_weekdays` | `branches` | DEFINER |
| `set_updated_at` | `—` | `trigger` | INVOKER |
| `staff_is_assigned_to_booking` | `p_booking_id uuid` | `boolean` | DEFINER |
| `staff_is_assigned_to_booking_vehicle` | `p_vehicle_id uuid` | `boolean` | DEFINER |
| `stamp_ops_form_resolved_at` | `—` | `trigger` | INVOKER |
| `start_assignments_on_booking_progress` | `—` | `trigger` | DEFINER |
| `start_late_queue_assignment` | `—` | `trigger` | INVOKER |
| `submit_expense_report` | `payload jsonb` | `jsonb` | DEFINER |
| `submit_public_ops_form` | `p_slug, p_payload jsonb, p_calendar_at, p_respondent_label` | `jsonb` | DEFINER |
| `submit_shift_close` | `payload jsonb` | `jsonb` | DEFINER |
| `sync_customer_full_name` | `—` | `trigger` | INVOKER |
| `sync_product_stock_group` | `p_product_id uuid` | `void` | DEFINER |
| `sync_queue_assignments` | `input_booking_id uuid, input_staff_ids uuid[]` | `TABLE` | DEFINER |
| `transition_expense` | `p_expense_id uuid, p_new_status text, p_notes text` | `expenses` | DEFINER |
| `trg_assign_booking_queue_number` | `—` | `trigger` | DEFINER |
| `trg_products_sync_stock_group` | `—` | `trigger` | DEFINER |
| `update_branch` | `input_branch_slug, input_name, input_code, input_address, input_is_active, lat, lng, coming_soon` | `branches` | DEFINER |
| `user_has_branch_access` | `input_branch text` | `boolean` | DEFINER |
| `write_audit_event` | `input_action, input_entity_type, input_entity_id, input_summary, input_meta jsonb` | `audit_logs` | DEFINER |

## User triggers (25)

| Table | Trigger | Timing | Function |
|---|---|---|---|
| `bookings` | `bookings_set_updated_at` | BEFORE UPDATE | `set_updated_at` |
| `bookings` | `bookings_soft_delete` | BEFORE DELETE | `archive_instead_of_delete` |
| `bookings` | `trg_assign_booking_queue_number` | BEFORE INSERT | `trg_assign_booking_queue_number` |
| `bookings` | `trg_create_completion_sms_event` | AFTER UPDATE OF status | `create_completion_sms_event` |
| `bookings` | `trg_handle_queue_timestamps` | BEFORE UPDATE OF status | `handle_queue_timestamps` |
| `bookings` | `trg_link_booking_to_masterlist` | BEFORE INSERT OR UPDATE (vehicle/customer fields) | `link_booking_to_masterlist` |
| `bookings` | `trg_log_queue_status_change` | AFTER UPDATE OF status | `log_queue_status_change` |
| `bookings` | `trg_start_assignments_on_booking_progress` | AFTER UPDATE OF status | `start_assignments_on_booking_progress` |
| `customers` | `customers_set_updated_at` | BEFORE UPDATE | `set_updated_at` |
| `customers` | `customers_soft_delete` | BEFORE DELETE | `archive_instead_of_delete` |
| `customers` | `customers_sync_full_name` | BEFORE INSERT OR UPDATE OF names | `sync_customer_full_name` |
| `ops_form_submissions` | `trg_stamp_ops_form_resolved_at` | BEFORE INSERT OR UPDATE OF status | `stamp_ops_form_resolved_at` |
| `ops_lab_statuses` | `trg_ops_lab_audit_statuses` | AFTER I/U/D | `ops_lab_audit_catalog_trg` |
| `ops_lab_types` | `trg_ops_lab_audit_types` | AFTER I/U/D | `ops_lab_audit_catalog_trg` |
| `ops_roadmap_items` | `trg_ops_lab_audit_items` | AFTER I/U/D | `ops_lab_audit_items_trg` |
| `plan_card_assignees` | `trg_guard_plan_card_assignee_self_update` | BEFORE UPDATE | `guard_plan_card_assignee_self_update` |
| `product_branch_stock` | `product_branch_stock_ba_guard` | BEFORE UPDATE | `guard_branch_stock_ba_increase` |
| `products` | `products_sync_stock_group` | AFTER UPDATE OF stock_qty | `trg_products_sync_stock_group` |
| `queue_assignments` | `trg_start_late_queue_assignment` | BEFORE INSERT | `start_late_queue_assignment` |
| `services` | `services_set_updated_at` | BEFORE UPDATE | `set_updated_at` |
| `services` | `services_soft_delete` | BEFORE DELETE | `archive_instead_of_delete` |
| `staff_attendance` | `staff_attendance_geofence` | BEFORE INSERT OR UPDATE | `enforce_staff_attendance_geofence` |
| `staff_attendance` | `staff_attendance_set_updated_at` | BEFORE UPDATE | `set_updated_at` |
| `transactions` | `transactions_set_updated_at` | BEFORE UPDATE | `set_updated_at` |
| `transactions` | `transactions_soft_delete` | BEFORE DELETE | `archive_instead_of_delete` |

## Critical CHECK highlights

- `bookings.vehicle_type` ∈ small|medium|large|extra_large|sedan|suv|pickup|van|motorcycle|other
- `services.pay_category` ∈ general|wash|addon|package|ppf|detailing
- `service_size_prices.size_slug` / `vehicle_catalog.size_slug` ∈ small|medium|large|extra_large
- `sales.status` ∈ pending|paid|cancelled|refunded|voided
- `shift_close_reports.status` ∈ draft|submitted|accepted|rejected|locked
- `payroll_runs.run_kind` ∈ floor|fixed; status ∈ confirmed|paid|void
- `expenses.status` ∈ draft|pending_approval|approved|pending_payment|paid|posted
- `queue_assignments.status` ∈ active|released|cancelled
- `plan_card_assignees.status` ∈ todo|in_progress|for_review|done
- Full CHECK catalog: query `pg_constraint` contype=`c` (150+ constraints live).

## FK map (all 146 — compact)

Format: `from_table.column → to_table` (ON DELETE/UPDATE omitted for length; see live `pg_constraint`).

- audit_logs.actor_id → auth.users
- blogs.created_by → auth.users
- bookings.created_by → auth.users
- bookings.price_edited_by → auth.users
- bookings.branch → branches.slug
- bookings.customer_id → customers
- bookings.final_checked_by → customers
- bookings.sent_to_payment_by → customers
- bookings.team_lead_id → customers
- bookings.service_id → services
- bookings.assigned_staff_id → staff_profiles
- bookings.redo_by → staff_profiles
- bookings.vehicle_id → vehicles
- branch_operating_hours.branch_slug → branches
- branches.created_by / updated_by → auth.users
- complaints.booking_id → bookings; branch → branches
- corporate_balances.created_by → staff_profiles
- customer_birthday_perks.customer_id → customers
- customer_memberships.customer_id → customers; tier_id → membership_tiers
- customer_notes → auth.users, complaints, customers, vehicles
- data_center_events.actor_id → auth.users
- event_registrations.event_id → events
- events.branch → branches; form_id → ops_forms
- expense_report_lines → expense_categories, expense_reports, expenses
- expense_reports → auth.users (submitted/reviewed), branches
- expense_status_events.expense_id → expenses
- expenses → branches, expense_categories, vendors
- finance_quotes → customers, staff_profiles
- inventory_recon_lines → inventory_recons, products
- inventory_recons → branches, staff_profiles
- loyalty_ledger → customers, sales
- notification_broadcasts → auth.users, branches
- notification_settings → auth.users, branches, services
- ops_form_submissions → auth.users, ops_forms, plan_cards
- ops_forms → auth.users, events
- ops_lab_statuses/types → staff_profiles
- ops_roadmap_boards → ops_form_submissions, staff_profiles
- ops_roadmap_items → ops_roadmap_boards, staff_profiles
- payroll_run_lines → branches, expenses, payroll_runs, staff_profiles
- payroll_run_sales → payroll_runs, sales
- payroll_runs.branch → branches
- plan_boards.created_by → auth.users
- plan_card_assignees → auth.users, plan_cards, staff_profiles
- plan_cards → auth.users, plan_categories, plan_lists
- plan_checklist_items → plan_cards
- plan_checklist_template_items → plan_checklist_templates
- plan_lists → plan_boards
- pos_handoffs → auth.users, bookings, branches, customers, transactions, vehicles
- product_branch_stock → branches, products
- product_stock_movements → branches, products
- products.branch_slug → branches
- push_subscriptions.user_id → auth.users
- queue_assignments → auth.users, bookings, staff_profiles
- queue_events → auth.users, bookings, branches
- sale_line_items → products, sales, services
- sales → bookings, branches, customers, pos_handoffs
- service_reviews → bookings, customers
- service_size_prices → services
- shift_close_reports → auth.users, branches
- sms_events → bookings, customers, vehicles
- staff_attendance → auth.users, branches, staff_profiles
- staff_branch_assignments → branches, staff_profiles
- staff_pay_packages → branches, staff_profiles
- staff_profiles → branches, role_definitions, staff_profiles (reports_to)
- staff_role_overrides → branches, staff_profiles
- transactions → bookings, customers, pos_handoffs, vehicles
- user_notifications.user_id → auth.users
- vehicle_maintenance_schedules → bookings, customers, vehicles
- vehicles → branches (first/last), customers

## Hub money join path

`bookings` → `pos_handoffs` → `sales` → `sale_line_items`; `sales` claimed by `payroll_run_sales` → `payroll_runs` / `payroll_run_lines`. `shift_close_reports` attest day only (no sale rewrite).

