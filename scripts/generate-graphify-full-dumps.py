# -*- coding: utf-8 -*-
"""Generate Graphify full DB / RLS / frontend knowledge dumps."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

RPCS = """
acknowledge_queue_assignment|p_assignment_id uuid|queue_assignments|DEFINER
admin_override_queue_status|input_booking_id uuid, input_next_status text, input_reason text|jsonb|DEFINER
archive_branch|input_branch_slug text|branches|DEFINER
archive_instead_of_delete||trigger|DEFINER
asa_has_grant|grant_key text|boolean|DEFINER
assert_pos_sale_integrity|payload jsonb|void|DEFINER
assign_daily_queue_number|p_branch text, p_queue_date date|integer|DEFINER
assign_persistent_queue_number|p_branch text|integer|DEFINER
award_loyalty_stamps|input_customer_id uuid, input_service_id uuid, input_quantity integer|integer|DEFINER
can_access_ops_roadmap||boolean|DEFINER
can_edit_planning||boolean|INVOKER
can_edit_queue_branch|input_branch text|boolean|INVOKER
can_manage_branch|target_branch text|boolean|DEFINER
can_read_queue_assignment|p_staff_id uuid, p_booking_id uuid|boolean|DEFINER
can_view_queue_branch|input_branch text|boolean|INVOKER
claim_birthday_perk|p_customer_id uuid, p_sale_id uuid|jsonb|DEFINER
complete_payment|input_booking_id uuid, input_payment_method text, input_reference_number text, input_payment_notes text|jsonb|DEFINER
complete_pos_sale|payload jsonb|jsonb|DEFINER
complete_pos_sale_impl|payload jsonb|jsonb|DEFINER
complete_queue_assignment|p_assignment_id uuid|queue_assignments|DEFINER
create_branch|input_name, input_slug, input_code, input_address, input_latitude, input_longitude, input_coming_soon, input_is_active|branches|DEFINER
create_completion_sms_event||trigger|INVOKER
current_user_branch||text|DEFINER
current_user_branch_slug||text|INVOKER
current_user_branch_slugs||text[]|DEFINER
current_user_role||text|DEFINER
enforce_staff_attendance_geofence||trigger|DEFINER
get_branch_throughput|input_start_date, input_end_date, input_branch_slug|TABLE|DEFINER
get_crew_kpi|input_start_date, input_end_date, input_branch_slug|TABLE|DEFINER
get_my_queue_work||TABLE|DEFINER
get_public_ops_form|p_slug text|jsonb|DEFINER
guard_branch_stock_ba_increase||trigger|INVOKER
guard_plan_card_assignee_self_update||trigger|DEFINER
handle_queue_timestamps||trigger|INVOKER
haversine_meters|lat1, lng1, lat2, lng2|float8|INVOKER
is_admin||boolean|INVOKER
is_assistant_super_admin||boolean|INVOKER
is_inquiry_reader||boolean|DEFINER
is_staff||boolean|DEFINER
is_super_admin||boolean|INVOKER
is_team_lead||boolean|INVOKER
link_booking_to_masterlist||trigger|INVOKER
list_birthday_customers|p_month, p_day|TABLE|DEFINER
log_queue_status_change||trigger|INVOKER
normalize_plate_number|input_plate text|text|INVOKER
ops_lab_audit_catalog_trg||trigger|DEFINER
ops_lab_audit_items_trg||trigger|DEFINER
ops_lab_write_audit|p_action, p_entity_type, p_entity_id, p_summary, p_meta jsonb|void|DEFINER
reactivate_branch|input_branch_slug text|branches|DEFINER
redeem_pos_loyalty_awards|payload jsonb|void|DEFINER
resolve_ops_lab_notify_user_ids|exclude_user uuid|uuid[]|DEFINER
review_expense_report|payload jsonb|jsonb|DEFINER
review_shift_close|payload jsonb|jsonb|DEFINER
run_payroll|payload jsonb|jsonb|DEFINER
send_queue_ticket_to_payment|input_booking_id uuid|jsonb|DEFINER
set_branch_hours|input_branch_slug, input_opens_at, input_closes_at, input_closed_weekdays|branches|DEFINER
set_updated_at||trigger|INVOKER
staff_is_assigned_to_booking|p_booking_id uuid|boolean|DEFINER
staff_is_assigned_to_booking_vehicle|p_vehicle_id uuid|boolean|DEFINER
stamp_ops_form_resolved_at||trigger|INVOKER
start_assignments_on_booking_progress||trigger|DEFINER
start_late_queue_assignment||trigger|INVOKER
submit_expense_report|payload jsonb|jsonb|DEFINER
submit_public_ops_form|p_slug, p_payload jsonb, p_calendar_at, p_respondent_label|jsonb|DEFINER
submit_shift_close|payload jsonb|jsonb|DEFINER
sync_customer_full_name||trigger|INVOKER
sync_product_stock_group|p_product_id uuid|void|DEFINER
sync_queue_assignments|input_booking_id uuid, input_staff_ids uuid[]|TABLE|DEFINER
transition_expense|p_expense_id uuid, p_new_status text, p_notes text|expenses|DEFINER
trg_assign_booking_queue_number||trigger|DEFINER
trg_products_sync_stock_group||trigger|DEFINER
update_branch|input_branch_slug, input_name, input_code, input_address, input_is_active, lat, lng, coming_soon|branches|DEFINER
user_has_branch_access|input_branch text|boolean|DEFINER
write_audit_event|input_action, input_entity_type, input_entity_id, input_summary, input_meta jsonb|audit_logs|DEFINER
""".strip()

TRIGGERS = """
bookings|bookings_set_updated_at|BEFORE UPDATE|set_updated_at
bookings|bookings_soft_delete|BEFORE DELETE|archive_instead_of_delete
bookings|trg_assign_booking_queue_number|BEFORE INSERT|trg_assign_booking_queue_number
bookings|trg_create_completion_sms_event|AFTER UPDATE OF status|create_completion_sms_event
bookings|trg_handle_queue_timestamps|BEFORE UPDATE OF status|handle_queue_timestamps
bookings|trg_link_booking_to_masterlist|BEFORE INSERT OR UPDATE (vehicle/customer fields)|link_booking_to_masterlist
bookings|trg_log_queue_status_change|AFTER UPDATE OF status|log_queue_status_change
bookings|trg_start_assignments_on_booking_progress|AFTER UPDATE OF status|start_assignments_on_booking_progress
customers|customers_set_updated_at|BEFORE UPDATE|set_updated_at
customers|customers_soft_delete|BEFORE DELETE|archive_instead_of_delete
customers|customers_sync_full_name|BEFORE INSERT OR UPDATE OF names|sync_customer_full_name
ops_form_submissions|trg_stamp_ops_form_resolved_at|BEFORE INSERT OR UPDATE OF status|stamp_ops_form_resolved_at
ops_lab_statuses|trg_ops_lab_audit_statuses|AFTER I/U/D|ops_lab_audit_catalog_trg
ops_lab_types|trg_ops_lab_audit_types|AFTER I/U/D|ops_lab_audit_catalog_trg
ops_roadmap_items|trg_ops_lab_audit_items|AFTER I/U/D|ops_lab_audit_items_trg
plan_card_assignees|trg_guard_plan_card_assignee_self_update|BEFORE UPDATE|guard_plan_card_assignee_self_update
product_branch_stock|product_branch_stock_ba_guard|BEFORE UPDATE|guard_branch_stock_ba_increase
products|products_sync_stock_group|AFTER UPDATE OF stock_qty|trg_products_sync_stock_group
queue_assignments|trg_start_late_queue_assignment|BEFORE INSERT|start_late_queue_assignment
services|services_set_updated_at|BEFORE UPDATE|set_updated_at
services|services_soft_delete|BEFORE DELETE|archive_instead_of_delete
staff_attendance|staff_attendance_geofence|BEFORE INSERT OR UPDATE|enforce_staff_attendance_geofence
staff_attendance|staff_attendance_set_updated_at|BEFORE UPDATE|set_updated_at
transactions|transactions_set_updated_at|BEFORE UPDATE|set_updated_at
transactions|transactions_soft_delete|BEFORE DELETE|archive_instead_of_delete
""".strip()


def write_db_full():
    out = []
    out.append("# Graphify DB full dump (live)")
    out.append("")
    out.append(
        "Verified 2026-09-15 via Supabase MCP (`lybxhpzzqqyqswvuwpxv`). "
        "Counts: **74** RPCs, **25** user triggers, **146** FKs, **245** RLS policies."
    )
    out.append("")
    out.append("## Enums")
    out.append("")
    out.append(
        "- `booking_status`: pending, confirmed, in_progress, completed, cancelled, no_show, "
        "waiting, final_checking, for_payment, redo, for_releasing"
    )
    out.append(
        "- `profile_role`: customer, staff, admin, team_lead, cashier (legacy), BossMich, "
        "marketing, sales, assistant_super_admin, detailer, video_editor, investor, operations_lead"
    )
    out.append("- `transaction_type`: sale, refund, expense, adjustment")
    out.append("")
    out.append("## Public RPCs")
    out.append("")
    out.append("| Function | Args | Returns | Security |")
    out.append("|---|---|---|---|")
    for row in RPCS.splitlines():
        name, args, result, security = row.split("|")
        out.append(f"| `{name}` | `{args or '—'}` | `{result}` | {security} |")
    out.append("")
    out.append("## User triggers (25)")
    out.append("")
    out.append("| Table | Trigger | Timing | Function |")
    out.append("|---|---|---|---|")
    for row in TRIGGERS.splitlines():
        table, trg, timing, fn = row.split("|")
        out.append(f"| `{table}` | `{trg}` | {timing} | `{fn}` |")
    out.append("")
    out.append("## Critical CHECK highlights")
    out.append("")
    out.append(
        "- `bookings.vehicle_type` ∈ small|medium|large|extra_large|sedan|suv|pickup|van|motorcycle|other"
    )
    out.append(
        "- `services.pay_category` ∈ general|wash|addon|package|ppf|detailing"
    )
    out.append(
        "- `service_size_prices.size_slug` / `vehicle_catalog.size_slug` ∈ small|medium|large|extra_large"
    )
    out.append(
        "- `sales.status` ∈ pending|paid|cancelled|refunded|voided"
    )
    out.append(
        "- `shift_close_reports.status` ∈ draft|submitted|accepted|rejected|locked"
    )
    out.append(
        "- `payroll_runs.run_kind` ∈ floor|fixed; status ∈ confirmed|paid|void"
    )
    out.append(
        "- `expenses.status` ∈ draft|pending_approval|approved|pending_payment|paid|posted"
    )
    out.append(
        "- `queue_assignments.status` ∈ active|released|cancelled"
    )
    out.append(
        "- `plan_card_assignees.status` ∈ todo|in_progress|for_review|done"
    )
    out.append(
        "- Full CHECK catalog: query `pg_constraint` contype=`c` (150+ constraints live)."
    )
    out.append("")
    out.append("## FK map (all 146 — compact)")
    out.append("")
    out.append("Format: `from_table.column → to_table` (ON DELETE/UPDATE omitted for length; see live `pg_constraint`).")
    out.append("")
    fks = [
        "audit_logs.actor_id → auth.users",
        "blogs.created_by → auth.users",
        "bookings.created_by → auth.users",
        "bookings.price_edited_by → auth.users",
        "bookings.branch → branches.slug",
        "bookings.customer_id → customers",
        "bookings.final_checked_by → customers",
        "bookings.sent_to_payment_by → customers",
        "bookings.team_lead_id → customers",
        "bookings.service_id → services",
        "bookings.assigned_staff_id → staff_profiles",
        "bookings.redo_by → staff_profiles",
        "bookings.vehicle_id → vehicles",
        "branch_operating_hours.branch_slug → branches",
        "branches.created_by / updated_by → auth.users",
        "complaints.booking_id → bookings; branch → branches",
        "corporate_balances.created_by → staff_profiles",
        "customer_birthday_perks.customer_id → customers",
        "customer_memberships.customer_id → customers; tier_id → membership_tiers",
        "customer_notes → auth.users, complaints, customers, vehicles",
        "data_center_events.actor_id → auth.users",
        "event_registrations.event_id → events",
        "events.branch → branches; form_id → ops_forms",
        "expense_report_lines → expense_categories, expense_reports, expenses",
        "expense_reports → auth.users (submitted/reviewed), branches",
        "expense_status_events.expense_id → expenses",
        "expenses → branches, expense_categories, vendors",
        "finance_quotes → customers, staff_profiles",
        "inventory_recon_lines → inventory_recons, products",
        "inventory_recons → branches, staff_profiles",
        "loyalty_ledger → customers, sales",
        "notification_broadcasts → auth.users, branches",
        "notification_settings → auth.users, branches, services",
        "ops_form_submissions → auth.users, ops_forms, plan_cards",
        "ops_forms → auth.users, events",
        "ops_lab_statuses/types → staff_profiles",
        "ops_roadmap_boards → ops_form_submissions, staff_profiles",
        "ops_roadmap_items → ops_roadmap_boards, staff_profiles",
        "payroll_run_lines → branches, expenses, payroll_runs, staff_profiles",
        "payroll_run_sales → payroll_runs, sales",
        "payroll_runs.branch → branches",
        "plan_boards.created_by → auth.users",
        "plan_card_assignees → auth.users, plan_cards, staff_profiles",
        "plan_cards → auth.users, plan_categories, plan_lists",
        "plan_checklist_items → plan_cards",
        "plan_checklist_template_items → plan_checklist_templates",
        "plan_lists → plan_boards",
        "pos_handoffs → auth.users, bookings, branches, customers, transactions, vehicles",
        "product_branch_stock → branches, products",
        "product_stock_movements → branches, products",
        "products.branch_slug → branches",
        "push_subscriptions.user_id → auth.users",
        "queue_assignments → auth.users, bookings, staff_profiles",
        "queue_events → auth.users, bookings, branches",
        "sale_line_items → products, sales, services",
        "sales → bookings, branches, customers, pos_handoffs",
        "service_reviews → bookings, customers",
        "service_size_prices → services",
        "shift_close_reports → auth.users, branches",
        "sms_events → bookings, customers, vehicles",
        "staff_attendance → auth.users, branches, staff_profiles",
        "staff_branch_assignments → branches, staff_profiles",
        "staff_pay_packages → branches, staff_profiles",
        "staff_profiles → branches, role_definitions, staff_profiles (reports_to)",
        "staff_role_overrides → branches, staff_profiles",
        "transactions → bookings, customers, pos_handoffs, vehicles",
        "user_notifications.user_id → auth.users",
        "vehicle_maintenance_schedules → bookings, customers, vehicles",
        "vehicles → branches (first/last), customers",
    ]
    for fk in fks:
        out.append(f"- {fk}")
    out.append("")
    out.append("## Hub money join path")
    out.append("")
    out.append(
        "`bookings` → `pos_handoffs` → `sales` → `sale_line_items`; "
        "`sales` claimed by `payroll_run_sales` → `payroll_runs` / `payroll_run_lines`. "
        "`shift_close_reports` attest day only (no sale rewrite)."
    )
    out.append("")
    (DOCS / "GRAPHIFY_DB_FULL.md").write_text("\n".join(out) + "\n", encoding="utf-8")
    print("wrote GRAPHIFY_DB_FULL.md")


def write_rls():
    text = """# Graphify hub RLS + storage policies (live)

Verified 2026-09-15. Expressions summarized from `pg_policies` (hub tables + `storage.objects`).

## Authz bridge (FE ↔ DB)

| Layer | Source of truth |
|-------|-----------------|
| SPA route gate | `allowRoute(profile, key)` + `OpsRoleGate` in `src/App.jsx` |
| Capability helpers | `src/auth/permissions.js` (`canAccess*`, `asa_has_grant` client mirror) |
| DB role helpers | `current_user_role()`, `asa_has_grant()`, `user_has_branch_access()`, `can_manage_branch()`, `is_*` |
| Money writes | SECURITY DEFINER RPCs — table INSERT policies often absent by design |

Frontend RBAC and RLS are **parallel**. Passing `allowRoute` does not imply a table INSERT policy; failing RLS does not show in the nav.

## Hub table policies (USING / WITH CHECK gist)

### bookings
- **INSERT** authenticated: `can_manage_branch(branch)` OR (sales AND status ∈ pending|confirmed)
- **SELECT**: self customer_id OR assigned staff OR sales OR (detailer/marketing + branch) OR `can_manage_branch`
- **UPDATE**: managers OR sales (broad status set) OR detailer on detailing/ppf services + branch

### sales / sale_line_items / pos_handoffs
- **sales SELECT**: SA / ASA finance_view / BA branch / TL own branch / marketing branch / sales|cashier / investor branch
- **sale_line_items SELECT**: exists parent sale visible
- **pos_handoffs SELECT**: branch access AND (admin OR team_lead)
- Writes via `complete_pos_sale` / handoff RPCs

### shift_close_reports / payroll_runs / expenses
- **EoS INSERT**: SA or BA with branch
- **EoS SELECT/UPDATE**: SA / ASA finance_view / BA branch (BA update limited statuses)
- **payroll_runs SELECT only**: SA / ASA finance_view / own lines — writes via `run_payroll`
- **expenses**: SA / ASA finance_* / BA branch; investor SELECT non-hq branch

### staff_profiles / customers / vehicles
- **staff SELECT**: SA/ASA / self / BA branch (+ assignments) / TL same branch
- **staff INSERT/UPDATE**: SA/ASA / BA (staff|TL) / TL (staff only, own branch)
- **customers**: CRM/queue grants + roles; self SELECT; insert customer role only
- **vehicles**: CRM/queue/pos grants + roles; staff SELECT if assigned to booking vehicle

### services / service_size_prices / products
- **SELECT**: anon active+!archived services; authenticated broader; products SELECT true for authenticated
- **write**: SA or ASA `services_merch` or `pos`

### plan_cards / queue_assignments / settings
- **plan_cards**: `can_edit_planning()` mutate; SELECT editors OR admin OR assignee
- **queue_assignments SELECT**: `can_read_queue_assignment`; UPDATE managers via booking branch
- **ops_pos_settings / role_definitions**: SA (+ ASA finance_write for POS settings); role_definitions SELECT `is_staff()`

## Storage (`storage.objects`)

| Bucket | Policies |
|--------|----------|
| `vehicle-photos` | public SELECT; authenticated INSERT/UPDATE |
| `content-media` | anon+auth SELECT; SA/ASA INSERT/UPDATE/DELETE |
| `booking-updates` | INSERT/UPDATE: admin/SA/sales/TL/ops_lead/ASA; SELECT adds marketing + owning customer via path `bookingId/...` |
| `plan-proofs` | path `{uid}/...`; INSERT/UPDATE editors or owner uid; SELECT editors/admin/owner |

Upsert still needs INSERT + SELECT + UPDATE.
"""
    (DOCS / "GRAPHIFY_RLS.md").write_text(text, encoding="utf-8")
    print("wrote GRAPHIFY_RLS.md")


def write_money():
    text = """# Graphify money RPC payloads (client → DB)

Source: `src/lib/posSale.js`, `src/lib/payroll.js`, `src/pages/PosPage.jsx`, `docs/POS/*`, `docs/PAYROLL/*`.
Live signatures: `complete_pos_sale(payload jsonb)`, `submit_shift_close(payload jsonb)`, `run_payroll(payload jsonb)`.

## `complete_pos_sale` / `complete_pos_sale_impl`

Built by `buildPosSalePayload`:

```js
{
  branch,                    // branch slug
  customer_id,               // uuid | null
  booking_id,                // uuid | null (from handoff)
  pos_handoff_id,            // uuid | null
  payment_method,            // cash | gcash | card (server allowlist)
  payment_ref,               // required for non-cash
  discount_reason,           // string | null
  discount_minor,            // int >= 0
  status: 'paid',
  notes,                     // string | null
  lines: [{
    item_type,               // service | product only
    service_id,              // uuid | null
    product_id,              // uuid | null
    name,
    quantity,
    unit_price_minor,        // 0 for loyalty/birthday/membership awards
    is_loyalty_award,
    is_birthday_award,
    is_membership_included,
    vehicle_size,            // small|medium|large|extra_large | null
  }]
}
```

Write set: `sales`, `sale_line_items`, stock movements, loyalty, handoff→completed, booking(s)→completed, audit; optional ceramic expense drafts.

## `submit_shift_close`

From POS End of shift wizard:

```js
{
  branch,
  business_date,             // Manila local YYYY-MM-DD
  shift_ended_at,            // ISO timestamptz
  pos_baseline,              // computed paid-sales snapshot object
  submitted,                 // attested drawer fields (cash/gcash/card/expenses/CA…)
  override_reasons,          // map when typed ≠ baseline
}
```

Does **not** insert sales or run payroll. Status → `submitted` for Finance `review_shift_close`.

## `run_payroll`

Built by `buildRunPayrollPayload`:

```js
{
  branch,                    // slug | null (all/hq patterns)
  frequency,                 // daily|weekly|…
  period_start, period_end,
  wash_pool_pct,
  notes,
  run_kind: 'floor' | 'fixed',
  sales: [{ sale_id, branch, total_minor, wash_pool_minor }],
  lines: [{
    staff_id, staff_name, branch,
    kind,                    // wash_pool|ceramic_*|adjustment|package_*…
    direction,               // add|deduct
    label, source_key, source_sale_id,
    attendance_weight,
    amount_minor,            // from preview pay_minor (>0 only)
  }]
}
```

Claims sales via `payroll_run_sales` (unique per sale). Hard-blocked when `pending_floor_optional=false` and closes not accepted.

## Related RPCs

| RPC | Args |
|-----|------|
| `send_queue_ticket_to_payment` | `input_booking_id uuid` |
| `review_shift_close` | `payload jsonb` (accept/reject/lock) |
| `review_expense_report` / `submit_expense_report` | `payload jsonb` |
| `redeem_pos_loyalty_awards` | `payload jsonb` |
| `transition_expense` | `p_expense_id, p_new_status, p_notes` |
"""
    (DOCS / "GRAPHIFY_MONEY_PAYLOADS.md").write_text(text, encoding="utf-8")
    print("wrote GRAPHIFY_MONEY_PAYLOADS.md")


def write_frontend():
    text = """# Graphify frontend + API seams

## Route map (`src/App.jsx`)

### Public
`/home`, `/services`, `/services/:slug`, `/book` (detailing), `/queue`, `/branches`, `/partnerships`, `/contact`, `/complaints`, `/events`, `/events/:slug`, `/blog`, `/blog/:slug`, `/f/:slug`, legal (`/terms` `/privacy` `/cookies`), `/403` `/404`.

### Customer (ProtectedRoute role=customer)
`/account`, `/account/blog`, `/account/events`, `/account/queue`, `/account/book`, `/account/loyalty`, `/account/more`; auth `/signin` `/signup` `/account/set-password`.

### Kiosk
`/queue/:branch`, `/queue/:branch/tv` (DEFINER views).

### Staff (`/operations/*` + OpsRoleGate)
| Path | allowRoute key |
|------|----------------|
| people | people |
| branches | branches |
| cars | cars |
| audit | audit |
| data-center | data-center |
| inquiries | inquiries |
| dashboard | dashboard |
| queue, queue/:id | queue |
| queue/new | queue-new |
| attendance | attendance |
| kpi | kpi |
| my-tasks | my-tasks |
| pos | pos |
| inventory (+ redirects services/products) | inventory |
| finance | finance |
| payroll | payroll |
| my-pay | my-pay |
| crm (+ sms redirect) | crm |
| bookings | bookings |
| planning | planning |
| roadmap | roadmap |
| settings, settings/pos, settings/daily-sheet | settings |
| content | content |
| notifications, broadcast | notifications |
| history | history |
| reports | reports |
| memberships | memberships |
| reviews | reviews |

Login: `/operations/login`. Legacy `/admin/*` redirects into operations.

## `allowRoute` keys → permission functions

`planning→canViewPlanning`, `roadmap→canAccessOpsRoadmap`, `people→canManagePeople`, `branches→canManageBranches`, `cars→canManageVehicleCatalog`, `audit→canAccessAudit`, `data-center→canAccessDataCenter`, `inquiries→canAccessInquiries`, `dashboard|queue|kpi→canViewQueueOperations`, `queue-new→canEditQueueOperations`, `attendance→canAccessAttendance`, `my-tasks→canViewAssignedTasks`, `pos→canAccessPos`, `inventory→canAccessInventory`, `finance→canOpenFinanceHub`, `crm→canAccessCrm`, `bookings→canAccessBookingBoard`, `reviews→canAccessReviews`, `reports→canAccessReports`, `memberships→canAccessMemberships`, `settings→canAccessSettings`, `content→canManageSiteContent`, `notifications|history→canAccess*`. Branch admin uses `BRANCH_ADMIN_ROUTE_KEYS` allowlist instead of the map.

## Detailer vs Queue viewer (resolved)

Detailer is on queue **viewer** capabilities for floor visibility / Failed QA context but **home/dock is Bookings**. Detailing SKUs never create wash Queue tickets (`serviceKinds` + queueApi reject). Sales home is Bookings (`US-SALES-01`).

## `/api/*` gateway

Vite `attachHakumApis` + Vercel `api/{bookings,customer,data-center,finance,notifications,public-inquiry,staff}.js` → `server/*.mjs`.

Paths: provision-customer/staff, update-staff, customer-portal/signup/auth-lookup/history, public-book/inquiry, plate-lookup, booking-status, maintenance-schedules, push-subscribe/send-push, notify-* (booking, ops-form, planner, pos, shift-close, ops-lab), lifecycle-sms, busybee, notification-*, birthday-greetings, send-finance-quote, data-center.

**Floor money stays PostgREST RPC**, not these routes.

## Public content note

`src/components/public/bredesign/content.js` is mostly static `IMAGES` URL map — AST extract yields almost no symbols. Treat tests `bredesign*.browser.test.js` + ServiceDetail rails as the graph entry.
"""
    (DOCS / "GRAPHIFY_FRONTEND.md").write_text(text, encoding="utf-8")
    print("wrote GRAPHIFY_FRONTEND.md")


def main():
    write_db_full()
    write_rls()
    write_money()
    write_frontend()


if __name__ == "__main__":
    main()
