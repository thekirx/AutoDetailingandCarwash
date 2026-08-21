-- B-30: remaining auth_rls_initplan — wrap auth.uid() in (select ...) for InitPlan.

drop policy if exists blogs_staff_select on public.blogs;
create policy blogs_staff_select
  on public.blogs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role = any (array['BossMich'::profile_role, 'assistant_super_admin'::profile_role, 'marketing'::profile_role])
    )
  );

drop policy if exists blogs_staff_write on public.blogs;
create policy blogs_staff_write
  on public.blogs
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role = any (array['BossMich'::profile_role, 'assistant_super_admin'::profile_role])
    )
  )
  with check (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role = any (array['BossMich'::profile_role, 'assistant_super_admin'::profile_role])
    )
  );

drop policy if exists notification_templates_staff_read on public.notification_templates;
create policy notification_templates_staff_read
  on public.notification_templates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role = any (array['BossMich'::profile_role, 'assistant_super_admin'::profile_role, 'marketing'::profile_role])
    )
  );

drop policy if exists notification_broadcast_kinds_staff_read on public.notification_broadcast_kinds;
create policy notification_broadcast_kinds_staff_read
  on public.notification_broadcast_kinds
  for select
  to authenticated
  using (
    (is_active = true)
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role = any (array['BossMich'::profile_role, 'assistant_super_admin'::profile_role, 'marketing'::profile_role])
    )
  );
