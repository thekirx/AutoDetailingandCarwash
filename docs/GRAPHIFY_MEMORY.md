# Hakum Auto Care — principal memory (Graphify seed)

Last verified live: 2026-09-15. Product: Hakum Auto Care. Repo: `thekirx/AutoDetailingandCarwash`. Stack: Vite + React SPA, PostgREST + `/api/*`, Supabase Auth + RLS. Live API: `https://lybxhpzzqqyqswvuwpxv.supabase.co`. Do not store service_role, `sbp_` tokens, or `.env` in this graph.

This file is the session-durable principal dump: domain rules, live schema, money path, RBAC, routes, and how agents should work. Pair with `CONTEXT.md`, `docs/OPS/MONEY-CONTRACT.md`, `docs/POS/`, `docs/PAYROLL/`.

## How future agents should remember

1. Query `graphify-out/graph.json` first (`graphify query`, `graphify path`, `graphify explain`).
2. If `graphify-out/wiki/index.md` exists, navigate wiki articles before grepping the whole tree.
3. After code changes: `graphify update .` (AST only). After doc changes: re-run semantic extract / `--update`.
4. Skills that stay in force: finish-goal (do not stop early), principal-system-audit (P0→P3, verify before PASS), Supabase skill (RLS, no user_metadata auth, no service_role in client, advisors before migrations).

## Architecture

- **Client:** `src/` React 19 + React Router 7 + Tailwind 4. Public site + customer portal + staff `/operations/*`.
- **Auth:** `@supabase/supabase-js`. Staff roles live in `staff_profiles.role` (and `app_metadata` — never `user_metadata` for authz). Customers are a separate portal.
- **Data:** Supabase Postgres. Floor writes go through SECURITY DEFINER RPCs (`complete_pos_sale`, `assign_daily_queue_number`, `send_queue_ticket_to_payment`, `run_payroll`, `submit_shift_close`, …). Direct table writes are RLS-gated.
- **API gateway:** `server/apiGateway.mjs` — Node `/api/*` for SMS (BusyBee), customer provision, public book, web push, data center, BrandTxt, etc. Vite proxies `/api` in `npm run dev`.
- **Migrations:** `supabase/migrations/` — apply via CLI/MCP; never invent filenames; use `supabase migration new`.
- **Money is integer minor units** (centavos). Display as pesos in UI.

## Domain split (do not blur)

| Surface | Owns | Does not own |
|---------|------|----------------|
| **Queue** | Same-day Services & Packages only. Daily queue numbers (Manila calendar). | Ceramic / tint / PPF film / paint maintenance |
| **Bookings board** | Multi-day detailing pipeline (Assigned → intake → … → release) | Wash bay tickets |
| **POS** | Paid tickets, merch, day expenses, CA repayments, End of shift attestation | Paying crew, rewriting history |
| **Finance** | Accept/reject/lock close; P&L from **paid POS + expenses** | Changing sales totals, auto-running payroll |
| **Payroll** | Floor pay from paid POS + attendance + ceramic keys; fixed packages; **manual** CA deduct | Inventing pay from close ₱ |

Detailing SKUs (must stay on Bookings, never Queue): `ceramic-coating`, `paint-maintenance`, `nano-ceramic-tint`, `paint-protection-film`. Code: `src/lib/serviceKinds.js`. Public `/book` is detailing-only. Wash queue rejects detailing SKUs (`src/queue/queueApi.js`, `server/publicBook.mjs`).

Legacy `pay_category=ppf` maps to **package** (same-day), not the Bookings board.

## Car sizes and pricing

Slugs: `small` | `medium` | `large` | `extra_large`.

| Size | Body |
|------|------|
| Small | sedans, hatchbacks, city cars |
| Medium | crossovers / compact CUVs |
| Large | SUVs, pickups, larger MPVs |
| Extra Large | full-size vans / people movers |

Legacy map: `sedan`→small, `motorcycle`→small, `suv`/`pickup`→large, `van`→extra_large. `services.price_minor` is the **Medium** catalog price. `service_size_prices` holds S/M/L/XL. Bay ratios: 0.85 / 1 / 1.2 / 1.4 (`src/lib/servicePricing.js`). Nameplate chart: `src/lib/phVehicleSizes.js`. Super Admin catalog: `/operations/cars` → `vehicle_catalog.size_slug`.

Live catalog counts (2026-09-15): 492 cars — 134 small / 127 medium / 151 large / 80 extra_large.

## Live catalog (active production SKUs)

Medium `price_minor` is centavos.

| slug | name | pay_category | kind | price_minor |
|------|------|--------------|------|-------------|
| premium-car-wash | Carwash | wash | service | 35000 |
| engine-wash | Engine Wash | addon | service | 80000 |
| glass-detailing | Glass Detailing | addon | service | 50000 |
| interior-detailing | Interior Detailing | general | service | 150000 |
| full-exterior-detailing | Full Exterior Detailing | general | service | 250000 |
| express-wash-package | Express Wash Package | package | package | 80000 |
| full-care-package | Full Care Package | package | package | 450000 |
| hakum-custom-package | Hakum Custom Package | package | package | 100000 |
| ceramic-coating | Ceramic Coating | detailing | detailing | 1500000 |
| nano-ceramic-tint | Nano Ceramic Tint | detailing | detailing | 800000 |
| paint-maintenance | Paint Maintenance | detailing | detailing | 350000 |
| paint-protection-film | Paint Protection Film (PPF) | detailing | detailing | 2500000 |

`pay_category` check constraint exists (migration `20260915120000_services_pay_category_check.sql`). Size chart resync: `20260915140000_vehicle_size_chart_resync.sql`. Advisor harden (FK indexes, RLS initplan, revoke ops_lab trigger EXECUTE): `20260915150000_db_advisor_harden.sql`.

Archived `audit-svc-*` / `crud-svc-*` rows are e2e leftovers — ignore for product copy.

## Money path (binding)

Source: `docs/OPS/MONEY-CONTRACT.md`.

```
Paid POS (services / packages / detailing / merch)
  → Bacoor report + End of shift (drawer attestation)
  → Finance accept → notify SA/ASA + Pending floor (hard gate)
  → SA/ASA confirms floor payroll (same night preferred)
```

- Sale write = RPC `complete_pos_sale` (impl `complete_pos_sale_impl`).
- Queue → POS = `send_queue_ticket_to_payment` + `pos_handoffs`.
- Queue numbers = `assign_daily_queue_number` on `queue_number_counters` (RPC-only; tables have RLS, **0 policies** — intentional).
- Detailing queue numbers persist until the ticket finishes (`assign_persistent_queue_number`).
- End of shift does **not** pay payroll. `pending_floor_optional = false` hard-blocks floor confirm until closes are accepted.
- CA deduct is **manual in payroll wizard only**. Approve CA on Payroll, not POS.
- Expense report: ASA submit → `pending_approval` → SA `pending_payment` → `approve_paid`/`mark_paid` → P&L. RPC `review_expense_report`.

## RBAC

Source of truth: `src/auth/permissions.js`. Super Admin role key is `BossMich`. ASA is `assistant_super_admin` with `permission_grants` toggles (`asa_has_grant`). Operations Lead is network-wide: planner + POS + queue (TL∪BA), all branches, My Pay, **no attendance clock**. Detailer: Bookings only, not wash Queue. Investor: read-scoped. Branch scope: `user_has_branch_access` / `current_user_branch_slugs`; null = all sites.

Ops login roles: staff, team_lead, operations_lead, sales, admin, BossMich, assistant_super_admin, marketing, detailer, video_editor, investor.

Never authorize from `user_metadata` / `raw_user_meta_data`. JWT `app_metadata` can be stale until refresh.

## Routes

Public: `/home`, `/services`, `/services/:slug`, `/book` (detailing), `/queue`, `/branches`, `/partnerships`, `/contact`, `/complaints`, `/events`, `/blog`, `/f/:slug` (public ops forms), legal pages. Customer: `/signin`, `/signup`, `/account/*`. Kiosk: `/queue/:branch`, `/queue/:branch/tv` (DEFINER views: `public_queue_counts`, `public_queue_numbers`, `public_queue_floor`, `public_home_stats`).

Staff `/operations/*` (gated by `OpsRoleGate`): dashboard, queue, queue/new, queue/:id, attendance, kpi, my-tasks, pos, inventory, finance, payroll, my-pay, crm, bookings, planning, roadmap (Ops Lab), settings, settings/pos, settings/payroll, content, notifications, history, broadcast, reports, memberships, reviews, people, branches, cars, audit, data-center, inquiries.

Data Center is Super Admin only. Catalog/CRM importable; floor/finance export-only (PITR).

## Live public schema (2026-09-15)

Tables (all RLS on): app_settings, audit_logs, blogs, bookings, branch_operating_hours, branches, compensation_settings, complaints, contact_inquiries, corporate_balances, customer_birthday_perks, customer_memberships, customer_notes, customers, data_center_events, data_center_settings, event_registrations, events, expense_categories, expense_report_lines, expense_reports, expense_status_events, expenses, finance_quotes, inventory_recon_lines, inventory_recons, loyalty_ledger, loyalty_milestones, loyalty_program_settings, membership_tiers, notification_broadcast_kinds, notification_broadcasts, notification_settings, notification_templates, ops_form_submissions, ops_forms, ops_lab_statuses, ops_lab_types, ops_pos_settings, ops_roadmap_boards, ops_roadmap_items, partnership_inquiries, payroll_run_lines, payroll_run_sales, payroll_runs, plan_boards, plan_card_assignees, plan_cards, plan_categories, plan_checklist_items, plan_checklist_template_items, plan_checklist_templates, plan_label_presets, plan_lists, pos_handoffs, product_branch_stock, product_stock_movements, products, push_subscriptions, queue_assignments, queue_events, queue_number_counters, queue_number_counters_persistent, role_definitions, sale_line_items, sales, service_reviews, service_size_prices, services, shift_close_field_config, shift_close_reports, sms_events, sms_templates, staff_attendance, staff_branch_assignments, staff_pay_packages, staff_profiles, staff_role_overrides, transactions, user_notifications, vehicle_catalog, vehicle_maintenance_schedules, vehicle_sizes, vehicles, vendors.

Views: active_customer_queue, available_staff_view, busy_staff_view, crew_kpi_summary, customer_vehicle_masterlist, daily_sales_summary, finance_branch_summary, finance_customer_retention, finance_daily_pl, finance_expense_by_category, operations_queue_board, pos_ready_tickets, public_home_stats, public_queue_counts, public_queue_floor, public_queue_numbers.

RLS with **0 policies** (RPC-only, intentional): `event_registrations`, `queue_number_counters`, `queue_number_counters_persistent`.

Public DEFINER (intentional kiosk/forms): views `public_queue_*` / `public_home_stats`; RPCs `get_public_ops_form`, `submit_public_ops_form`.

Hub tables (god-node candidates): `bookings` (queue + detailing tickets), `sales` + `sale_line_items`, `staff_profiles`, `customers` + `vehicles`, `services` + `service_size_prices`, `pos_handoffs`, `payroll_runs`, `plan_cards`.

## Critical RPCs (SECURITY DEFINER unless noted)

Money: `complete_pos_sale`, `complete_pos_sale_impl`, `assert_pos_sale_integrity`, `complete_payment`, `send_queue_ticket_to_payment`, `submit_shift_close`, `review_shift_close`, `run_payroll`, `submit_expense_report`, `review_expense_report`, `transition_expense`, `redeem_pos_loyalty_awards`, `award_loyalty_stamps`, `claim_birthday_perk`.

Queue: `assign_daily_queue_number`, `assign_persistent_queue_number`, `sync_queue_assignments`, `acknowledge_queue_assignment`, `complete_queue_assignment`, `admin_override_queue_status`, `get_my_queue_work`.

Authz helpers: `current_user_role`, `current_user_branch_slugs`, `user_has_branch_access`, `is_staff`, `is_super_admin` (INVOKER), `is_team_lead` (INVOKER), `asa_has_grant`, `can_manage_branch`.

Ops Lab: `can_access_ops_roadmap`, `ops_lab_write_audit` — `ops_lab_audit_*_trg` EXECUTE revoked from anon/authenticated.

Public: `get_public_ops_form`, `submit_public_ops_form`.

## Supabase product rules (keep in graph)

- RLS on every exposed `public` table.
- Views bypass RLS unless `security_invoker = true` (PG15+). Public queue views are DEFINER by design — they project only branch/queue_number/status.
- UPDATE needs a SELECT policy or updates return 0 rows silently.
- Do not put extra SECURITY DEFINER functions in exposed schema without a reason; staff RPCs stay because auth is inside the function.
- Storage upsert needs INSERT + SELECT + UPDATE.
- Deleting a user does not revoke existing JWTs.
- Auth leaked-password protection was **disabled** in dashboard (INFO leftover) — toggle in Auth settings, not SQL.
- Multiple permissive SELECT policies remain on expense reports/lines, `ops_pos_settings`, `role_definitions` (INFO).
- MCP: `user-supabase` / `plugin-supabase-supabase`. Prefer `search_docs` before inventing API. Schema iterate with `execute_sql`; commit with `supabase db pull` / migration files. Do not use `apply_migration` for local iteration (pollutes history).

## Intentional denorm

Booking rows snapshot customer/vehicle fields at ticket time so floor history does not drift when CRM updates later.

## Loyalty

Singleton `loyalty_program_settings`. Stamp earn: `all_weighted` or `pay_categories`. `services.loyalty_weight` × qty → stamp delta (0 = never earns). Membership `discount_percent` + `included_services` apply on catalog POS lines; queue handoffs keep floor price.

## Planner / Ops Lab

Planner: `plan_cards` + categories/lists/boards. Proof photos in private `plan-proofs`. Ops Lab `/operations/roadmap`: custom types/statuses, notify peers, audited actions for SA.

## Verification commands

`npm run lint`, `npm test`, `npm run build`, `npm run e2e:ui-p0`, `npm run e2e:ui-money`, `npm run e2e:role-qa`, `npm run e2e:money-path`. Principal audit report: `docs/SYSTEM_AUDIT.md` (create/update only when a real P0→P7 audit runs — this Graphify ingest is not that audit).

## Security note for agents

Never commit `.env`, service_role, or personal access tokens. A management token was pasted in an earlier chat — rotate it; do not put it in graphify-out or git.
