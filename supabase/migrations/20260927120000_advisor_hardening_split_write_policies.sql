-- Advisor hardening (2026-09-27). Access semantics unchanged.
-- 1) catalog_line_kind: pin search_path (function_search_path_mutable).
-- 2) stamp_sale_line_kind is a trigger fn — no RPC callers (trigger fire does not check EXECUTE).
-- 3) Split FOR ALL *_write policies into insert/update/delete so SELECT is one policy
--    (multiple_permissive_policies). role_definitions select keeps SA: is_staff() excludes BossMich.

alter function public.catalog_line_kind(text, text, text) set search_path = pg_catalog, public;

revoke execute on function public.stamp_sale_line_kind() from public, anon, authenticated;

-- expense_reports: select (SA ∨ finance_view ∨ finance_write) already ⊇ write
drop policy if exists expense_reports_write on public.expense_reports;
create policy expense_reports_insert on public.expense_reports for insert to authenticated
  with check (public.is_super_admin() or public.asa_has_grant('finance_write'));
create policy expense_reports_update on public.expense_reports for update to authenticated
  using (public.is_super_admin() or public.asa_has_grant('finance_write'))
  with check (public.is_super_admin() or public.asa_has_grant('finance_write'));
create policy expense_reports_delete on public.expense_reports for delete to authenticated
  using (public.is_super_admin() or public.asa_has_grant('finance_write'));

-- expense_report_lines: select via parent report (same grants) already ⊇ write
drop policy if exists expense_report_lines_write on public.expense_report_lines;
create policy expense_report_lines_insert on public.expense_report_lines for insert to authenticated
  with check (public.is_super_admin() or public.asa_has_grant('finance_write'));
create policy expense_report_lines_update on public.expense_report_lines for update to authenticated
  using (public.is_super_admin() or public.asa_has_grant('finance_write'))
  with check (public.is_super_admin() or public.asa_has_grant('finance_write'));
create policy expense_report_lines_delete on public.expense_report_lines for delete to authenticated
  using (public.is_super_admin() or public.asa_has_grant('finance_write'));

-- ops_pos_settings: select is true
drop policy if exists ops_pos_settings_write on public.ops_pos_settings;
create policy ops_pos_settings_insert on public.ops_pos_settings for insert to authenticated
  with check (public.is_super_admin() or public.asa_has_grant('finance_write'));
create policy ops_pos_settings_update on public.ops_pos_settings for update to authenticated
  using (public.is_super_admin() or public.asa_has_grant('finance_write'))
  with check (public.is_super_admin() or public.asa_has_grant('finance_write'));
create policy ops_pos_settings_delete on public.ops_pos_settings for delete to authenticated
  using (public.is_super_admin() or public.asa_has_grant('finance_write'));

-- role_definitions
drop policy if exists role_definitions_select on public.role_definitions;
drop policy if exists role_definitions_write on public.role_definitions;
create policy role_definitions_select on public.role_definitions for select to authenticated
  using (public.is_staff() or public.is_super_admin());
create policy role_definitions_insert on public.role_definitions for insert to authenticated
  with check (public.is_super_admin());
create policy role_definitions_update on public.role_definitions for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
create policy role_definitions_delete on public.role_definitions for delete to authenticated
  using (public.is_super_admin());
