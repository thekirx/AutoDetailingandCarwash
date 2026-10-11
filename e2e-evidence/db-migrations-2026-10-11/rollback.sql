-- Restores the production policies touched on 2026-10-11 to their exact
-- pre-migration definitions (read from pg_policies just before applying).
-- Functions: re-run the pre-migration bodies in 20261001090000_daily_sheet.sql
-- for review_daily_sheet / daily_sheet_server_totals (verified identical to
-- live apart from the BUG-085 guard and the BUG-086 cash expression).

begin;

drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_delete" on public.expenses for delete to authenticated
using (is_super_admin() or (is_assistant_super_admin() and asa_has_grant('finance_write')) or (is_admin() and user_has_branch_access(branch)));

drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update" on public.expenses for update to authenticated
using (is_super_admin() or (is_assistant_super_admin() and asa_has_grant('finance_write')) or (is_admin() and user_has_branch_access(branch)))
with check (is_super_admin() or (is_assistant_super_admin() and asa_has_grant('finance_write')) or (is_admin() and user_has_branch_access(branch)));

drop policy if exists "transactions_select" on public.transactions;
drop policy if exists "Admin has full access to transactions" on public.transactions;
create policy "Admin has full access to transactions" on public.transactions for all to authenticated
using (is_admin()) with check (is_admin());

drop policy if exists "user_notifications_select" on public.user_notifications;
create policy "user_notifications_select" on public.user_notifications for select to authenticated
using ((user_id = (select auth.uid())) or is_admin());

drop policy if exists "user_notifications_insert" on public.user_notifications;
drop policy if exists "Admins insert notifications" on public.user_notifications;
create policy "Admins insert notifications" on public.user_notifications for insert to authenticated
with check (is_admin());

drop policy if exists "Marketing sms templates" on public.sms_templates;
create policy "Marketing sms templates" on public.sms_templates for all to authenticated
using ((select is_admin()) or ((select current_user_role()) = 'marketing'))
with check ((select is_admin()) or ((select current_user_role()) = 'marketing'));

commit;
