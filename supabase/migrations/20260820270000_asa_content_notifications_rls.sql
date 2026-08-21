-- B-31: blogs/notification RLS was wider than app grants for ASA.
-- Align with permissions.js: content / notifications grants.

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
        and (
          sp.role = 'BossMich'::profile_role
          or sp.role = 'marketing'::profile_role
          or (sp.role = 'assistant_super_admin'::profile_role and public.asa_has_grant('content'))
        )
    )
  );

drop policy if exists blogs_staff_write on public.blogs;
create policy blogs_staff_write
  on public.blogs
  for all
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('content')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('content')
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
        and (
          sp.role = 'BossMich'::profile_role
          or sp.role = 'marketing'::profile_role
          or (sp.role = 'assistant_super_admin'::profile_role and public.asa_has_grant('notifications'))
        )
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
        and (
          sp.role = 'BossMich'::profile_role
          or sp.role = 'marketing'::profile_role
          or (sp.role = 'assistant_super_admin'::profile_role and public.asa_has_grant('notifications'))
        )
    )
  );
