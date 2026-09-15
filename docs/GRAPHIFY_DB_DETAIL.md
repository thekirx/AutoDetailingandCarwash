# Hakum — live columns + RLS policy names (Graphify gap fill)

Verified 2026-09-15 via Supabase MCP. Complements `docs/GRAPHIFY_MEMORY.md` (table inventory) and `docs/GRAPHIFY_WORKFLOWS.md` (enums/API).

## Key table columns

- **bookings:** `id, customer_id, service_id, branch, status, vehicle_type, queue_number, queue_date, visit_group_id, price_minor, final_price_minor, completion_outcome, assigned_staff_id, team_lead_id, vehicle_*, timestamps (waiting_at … cancelled_at), redo_*`
- **sales:** `id, branch, customer_id, booking_id, pos_handoff_id, status, payment_method, subtotal_minor, total_minor, discount_minor, discount_reason, payment_ref, occurred_at`
- **sale_line_items:** `id, sale_id, item_type, service_id, product_id, name, quantity, unit_price_minor, line_total_minor`
- **services:** `id, name, slug, price_minor, pay_category, included_service_ids, loyalty_weight, salary_pct, sla_minutes, duration_minutes, is_active, is_archived`
- **service_size_prices:** `id, service_id, size_slug, price_minor`
- **pos_handoffs:** `id, booking_id, transaction_id, customer_id, vehicle_id, branch, amount_minor, status, handed_off_by, handed_off_at, completed_at`
- **shift_close_reports:** `id, branch, business_date, status, pos_baseline, submitted, override_reasons, review_note, submitted_by, reviewed_by, shift_ended_at`
- **payroll_runs:** `id, branch, run_kind, frequency, period_start, period_end, status, wash_pool_pct, pos_sales_minor, total_payout_minor, confirmed_by`
- **expenses:** `id, title, quantity, unit_cost_minor, total_minor, branch, category_id, status, expense_kind, vendor_id, attachment_path`
- **staff_profiles:** `id, full_name, role, branch_slug, permission_grants, attendance_enabled, geofence_enabled, custom_role_key, reports_to, is_supervisor`
- **customers:** `id, role, full_name, email, phone, loyalty_points, loyalty_stamps, date_of_birth, notify_sms, notify_push, is_disabled`
- **vehicles:** `id, customer_id, plate_number, normalized_plate_number, vehicle_make, vehicle_model, vehicle_type, first_branch, last_branch, total_visits`
- **vehicle_catalog:** `id, make, model, size_slug, is_active, sort_order`
- **queue_assignments:** `id, booking_id, staff_id, status, started_at, completed_at, released_at, cancelled_at, task_name`
- **queue_number_counters:** `branch, queue_date, last_value` (RLS on, **0 policies** — RPC-only)

## Critical RLS policies

### bookings
- INSERT: bookings_insert
- SELECT: bookings_select
- UPDATE: bookings_update

### sales / sale_line_items / pos_handoffs
- sales SELECT: sales_select (writes via `complete_pos_sale` DEFINER)
- sale_line_items SELECT: Staff read sale lines
- pos_handoffs SELECT: Authorized payment users can read handoffs

### services / service_size_prices
- services: services_select_anon, services_select_authenticated, services_insert, services_update, services_delete
- service_size_prices: select/insert/update/delete (staff catalog)

### shift_close_reports / payroll_runs / expenses
- shift_close_reports: insert, select, update
- payroll_runs: select only (writes via `run_payroll` DEFINER)
- expenses: expenses_select, expenses_write (INSERT), expenses_update, expenses_delete

### staff / customers / vehicles / catalog
- staff_profiles: Authorized users can read staff profiles; Queue managers insert/update branch staff
- customers: customers_select/insert/update/delete
- vehicles: vehicles_select/insert/update/delete
- vehicle_catalog: vehicle_catalog_select/insert/update/delete

### queue_assignments / planner / products / settings
- queue_assignments: Authorized users can read; Managers can update
- plan_cards: select/insert/update/delete
- products: Staff read products; products_insert/update/delete
- ops_pos_settings: select + write (ALL)
- role_definitions: select + write (ALL)

### RPC-only (0 policies, intentional)
- event_registrations
- queue_number_counters
- queue_number_counters_persistent

## Write paths that bypass table INSERT policies

Money and queue allocation go through SECURITY DEFINER RPCs (`complete_pos_sale`, `assign_daily_queue_number`, `send_queue_ticket_to_payment`, `submit_shift_close`, `run_payroll`, …). Client SELECT policies still apply for reads.
