# Graphify hub RLS + storage policies (live)

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
