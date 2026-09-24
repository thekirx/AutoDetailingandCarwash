# Graphify seams — machine facts principals re-ask for

Verified live 2026-09-15. Names only — never paste secret values. Complements `GRAPHIFY_MEMORY.md` / `GRAPHIFY_WORKFLOWS.md` / `GRAPHIFY_DB_DETAIL.md`. Gap analysis: `GRAPHIFY_GAPS.md`.

## Env names (from `.env.example`)

| Name | Surface |
|------|---------|
| `VITE_SUPABASE_URL` | SPA |
| `VITE_SUPABASE_ANON_KEY` | SPA |
| `VITE_ENABLE_DEMO_LOGIN` | SPA (also auto-on `*.vercel.app`) |
| `SUPABASE_URL` | Server `/api` |
| `SUPABASE_ANON_KEY` | Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `SUPABASE_SECRET_KEY` | Server (`sb_secret_…`) |
| `BUSYBEE_API_BASE_URL` | SMS (BrandTxt `https://app.brandtxt.io`) |
| `BUSYBEE_API_KEY` / `BUSYBEE_CLIENT_ID` / `BUSYBEE_SENDER_ID` | SMS |
| `OWNER_SMS_PHONE` / `ENABLE_OWNER_SMS` | Legacy only — product default **no owner SMS**; customer outbound reminders only |
| `VITE_VAPID_PUBLIC_KEY` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push |
| `RESEND_API_KEY` / `RESEND_FROM` | Finance quotations |

Ops still required outside git: Auth SMTP templates, Vercel↔local name parity, BrandTxt IP allowlist, leaked-password protection toggle.

## Vercel / Vite `/api` entrypoints

Disk `api/*.js` gateways: `bookings`, `customer`, `data-center`, `finance`, `notifications`, `public-inquiry`, `staff`. Impl lives mainly in `server/*.mjs`; Vite `attachHakumApis` mirrors in dev.

## Critical money RPC signatures (live)

| Function | Args |
|----------|------|
| `complete_pos_sale` | `payload jsonb` |
| `complete_pos_sale_impl` | `payload jsonb` |
| `send_queue_ticket_to_payment` | `input_booking_id uuid` |
| `submit_shift_close` | `payload jsonb` |
| `review_shift_close` | `payload jsonb` |
| `run_payroll` | `payload jsonb` |
| `assign_daily_queue_number` | `p_branch text, p_queue_date date` |
| `assign_persistent_queue_number` | `p_branch text` |
| `sync_queue_assignments` | `input_booking_id uuid, input_staff_ids uuid[]` |
| `review_expense_report` | `payload jsonb` |
| `redeem_pos_loyalty_awards` | `payload jsonb` |

Payload field shapes: see `docs/GRAPHIFY_MONEY_PAYLOADS.md` (and `docs/POS/*`, `docs/PAYROLL/*`).

Full RPC args + triggers + FK map: `docs/GRAPHIFY_DB_FULL.md`.
Hub RLS + storage: `docs/GRAPHIFY_RLS.md`.
Frontend routes / allowRoute: `docs/GRAPHIFY_FRONTEND.md`.

## Full public RPC inventory (74)

`acknowledge_queue_assignment`, `admin_override_queue_status`, `archive_branch`, `archive_instead_of_delete`, `asa_has_grant`, `assert_pos_sale_integrity`, `assign_daily_queue_number`, `assign_persistent_queue_number`, `award_loyalty_stamps`, `can_access_ops_roadmap`, `can_edit_planning`, `can_edit_queue_branch`, `can_manage_branch`, `can_read_queue_assignment`, `can_view_queue_branch`, `claim_birthday_perk`, `complete_payment`, `complete_pos_sale`, `complete_pos_sale_impl`, `complete_queue_assignment`, `create_branch`, `create_completion_sms_event`, `current_user_branch`, `current_user_branch_slug`, `current_user_branch_slugs`, `current_user_role`, `enforce_staff_attendance_geofence`, `get_branch_throughput`, `get_crew_kpi`, `get_my_queue_work`, `get_public_ops_form`, `guard_branch_stock_ba_increase`, `guard_plan_card_assignee_self_update`, `handle_queue_timestamps`, `haversine_meters`, `is_admin`, `is_assistant_super_admin`, `is_inquiry_reader`, `is_staff`, `is_super_admin`, `is_team_lead`, `link_booking_to_masterlist`, `list_birthday_customers`, `log_queue_status_change`, `normalize_plate_number`, `ops_lab_audit_catalog_trg`, `ops_lab_audit_items_trg`, `ops_lab_write_audit`, `reactivate_branch`, `redeem_pos_loyalty_awards`, `resolve_ops_lab_notify_user_ids`, `review_expense_report`, `review_shift_close`, `run_payroll`, `send_queue_ticket_to_payment`, `set_branch_hours`, `set_updated_at`, `staff_is_assigned_to_booking`, `staff_is_assigned_to_booking_vehicle`, `stamp_ops_form_resolved_at`, `start_assignments_on_booking_progress`, `start_late_queue_assignment`, `submit_expense_report`, `submit_public_ops_form`, `submit_shift_close`, `sync_customer_full_name`, `sync_product_stock_group`, `sync_queue_assignments`, `transition_expense`, `trg_assign_booking_queue_number`, `trg_products_sync_stock_group`, `update_branch`, `user_has_branch_access`, `write_audit_event`.

Live counts: **74** functions, **146** FKs, **245** RLS policies, **25** user triggers.

## Hub FK pairs (top fan-in)

- `bookings` → `customers` (4), `auth.users` (2), `staff_profiles` (2), `branches`, `services`, `vehicles`
- `queue_assignments` → `auth.users` (2)
- `shift_close_reports` → `auth.users` (2)
- `expense_reports` → `auth.users` (2)
- `vehicles` → `branches` (2)
- `customer_memberships` → `customers`, `membership_tiers`
- `expense_report_lines` → `expense_reports`, `expense_categories`, `expenses`
- Ops Lab: `ops_lab_*` / `ops_roadmap_*` → `staff_profiles`

## Storage buckets (live)

| Bucket | Public |
|--------|--------|
| `content-media` | yes |
| `vehicle-photos` | yes |
| `booking-updates` | no |
| `plan-proofs` | no |

## Refresh recipe

```powershell
$env:PATH = "C:\Users\jcuad\.local\bin;$env:PATH"
graphify update .   # after src/ pulls
# After editing these GRAPHIFY_*.md files, run assistant /graphify --update for semantic nodes
```
