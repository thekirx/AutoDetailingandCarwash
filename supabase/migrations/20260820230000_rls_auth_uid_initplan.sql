-- B-29: wrap auth.uid() in (select ...) so RLS InitPlan runs once per statement.
-- Advisor: auth_rls_initplan on hot read paths.

drop policy if exists staff_branch_assignments_select on public.staff_branch_assignments;
create policy staff_branch_assignments_select
  on public.staff_branch_assignments
  for select
  to authenticated
  using (
    (staff_id = (select auth.uid()))
    or (current_user_role() = any (array['BossMich'::text, 'assistant_super_admin'::text, 'admin'::text]))
  );

drop policy if exists customer_birthday_perks_own_read on public.customer_birthday_perks;
create policy customer_birthday_perks_own_read
  on public.customer_birthday_perks
  for select
  to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists customer_birthday_perks_staff_read on public.customer_birthday_perks;
create policy customer_birthday_perks_staff_read
  on public.customer_birthday_perks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
    )
  );
