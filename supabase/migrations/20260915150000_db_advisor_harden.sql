-- Principal DB harden: FK covering indexes, RLS auth initplan, revoke trigger RPCs.
-- Addresses Supabase advisors (performance WARN + security WARN on trigger EXECUTE).

-- 1) Trigger functions must not be callable via PostgREST RPC.
revoke all on function public.ops_lab_audit_catalog_trg() from public, anon, authenticated;
revoke all on function public.ops_lab_audit_items_trg() from public, anon, authenticated;

-- 2) Covering indexes for unindexed foreign keys (join/cascade hot paths).
create index if not exists corporate_balances_created_by_idx
  on public.corporate_balances (created_by);
create index if not exists customer_notes_created_by_idx
  on public.customer_notes (created_by);
create index if not exists customer_notes_vehicle_id_idx
  on public.customer_notes (vehicle_id);
create index if not exists expense_report_lines_category_id_idx
  on public.expense_report_lines (category_id);
create index if not exists expense_report_lines_expense_id_idx
  on public.expense_report_lines (expense_id);
create index if not exists expense_reports_branch_idx
  on public.expense_reports (branch);
create index if not exists expense_reports_reviewed_by_idx
  on public.expense_reports (reviewed_by);
create index if not exists expense_reports_submitted_by_idx
  on public.expense_reports (submitted_by);
create index if not exists finance_quotes_created_by_idx
  on public.finance_quotes (created_by);
create index if not exists inventory_recon_lines_product_id_idx
  on public.inventory_recon_lines (product_id);
create index if not exists inventory_recons_reviewed_by_idx
  on public.inventory_recons (reviewed_by);
create index if not exists inventory_recons_submitted_by_idx
  on public.inventory_recons (submitted_by);
create index if not exists ops_lab_statuses_created_by_idx
  on public.ops_lab_statuses (created_by);
create index if not exists ops_lab_statuses_updated_by_idx
  on public.ops_lab_statuses (updated_by);
create index if not exists ops_lab_types_created_by_idx
  on public.ops_lab_types (created_by);
create index if not exists ops_lab_types_updated_by_idx
  on public.ops_lab_types (updated_by);
create index if not exists ops_roadmap_boards_created_by_idx
  on public.ops_roadmap_boards (created_by);
create index if not exists ops_roadmap_boards_linked_form_submission_id_idx
  on public.ops_roadmap_boards (linked_form_submission_id);
create index if not exists ops_roadmap_boards_updated_by_idx
  on public.ops_roadmap_boards (updated_by);
create index if not exists ops_roadmap_items_created_by_idx
  on public.ops_roadmap_items (created_by);
create index if not exists ops_roadmap_items_updated_by_idx
  on public.ops_roadmap_items (updated_by);
create index if not exists shift_close_reports_reviewed_by_idx
  on public.shift_close_reports (reviewed_by);
create index if not exists shift_close_reports_submitted_by_idx
  on public.shift_close_reports (submitted_by);
create index if not exists staff_role_overrides_branch_slug_idx
  on public.staff_role_overrides (branch_slug);
create index if not exists staff_role_overrides_created_by_idx
  on public.staff_role_overrides (created_by);

-- Hot catalog lookups used by size pricing resolution.
create index if not exists vehicle_catalog_active_make_model_idx
  on public.vehicle_catalog (lower(make), lower(model))
  where is_active = true;
create index if not exists service_size_prices_size_slug_idx
  on public.service_size_prices (size_slug);

-- 3) RLS initplan: wrap auth.uid() in (select ...) so it evaluates once per query.
drop policy if exists staff_role_overrides_select on public.staff_role_overrides;
create policy staff_role_overrides_select on public.staff_role_overrides
  for select to authenticated
  using (
    is_super_admin()
    or is_assistant_super_admin()
    or user_has_branch_access(branch_slug)
    or (staff_id = (select auth.uid()))
  );

drop policy if exists staff_pay_packages_select on public.staff_pay_packages;
create policy staff_pay_packages_select on public.staff_pay_packages
  for select to authenticated
  using (
    is_super_admin()
    or asa_has_grant('finance_view')
    or asa_has_grant('finance_write')
    or (staff_id = (select auth.uid()))
  );

drop policy if exists ops_roadmap_boards_insert on public.ops_roadmap_boards;
create policy ops_roadmap_boards_insert on public.ops_roadmap_boards
  for insert to authenticated
  with check (
    can_access_ops_roadmap()
    and (created_by = (select auth.uid()))
  );

drop policy if exists ops_roadmap_boards_delete on public.ops_roadmap_boards;
create policy ops_roadmap_boards_delete on public.ops_roadmap_boards
  for delete to authenticated
  using (
    can_access_ops_roadmap()
    and (
      (created_by = (select auth.uid()))
      or (current_user_role() = 'BossMich')
    )
  );

drop policy if exists ops_roadmap_items_insert on public.ops_roadmap_items;
create policy ops_roadmap_items_insert on public.ops_roadmap_items
  for insert to authenticated
  with check (
    can_access_ops_roadmap()
    and (created_by = (select auth.uid()))
  );

drop policy if exists product_stock_movements_insert on public.product_stock_movements;
create policy product_stock_movements_insert on public.product_stock_movements
  for insert to authenticated
  with check (
    (
      (created_by = (select auth.uid()))
      and (
        (is_super_admin() or (is_assistant_super_admin() and asa_has_grant('services_merch')))
        and (movement_type = any (array['restock'::text, 'recon_adjust'::text, 'owner_set'::text, 'sale'::text]))
        and (
          (branch_slug is null)
          or user_has_branch_access(branch_slug)
          or is_super_admin()
        )
      )
    )
    or (
      (current_user_role() = 'admin')
      and (movement_type = 'restock')
      and (delta > 0)
      and (branch_slug is not null)
      and user_has_branch_access(branch_slug)
    )
  );
