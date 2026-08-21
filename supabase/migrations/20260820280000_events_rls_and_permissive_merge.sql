-- Slice R: B-32 events write vs app gates + OPT-09 safe permissive merges.
-- Events: app allows Content (content grant) OR Planning edit (SA/BA/ASA planning_edit).
-- Not bare is_admin() (that included every ASA) and not marketing write (no Content/Planning edit UI).

-- ── events ──────────────────────────────────────────────────────────────
drop policy if exists "Admins manage events" on public.events;
drop policy if exists "Public read events" on public.events;

create policy events_select
  on public.events
  for select
  to anon, authenticated
  using (
    is_published = true
    or (
      (select auth.uid()) is not null
      and (
        public.is_super_admin()
        or public.current_user_role() = 'admin'
        or public.asa_has_grant('planning_edit')
        or public.asa_has_grant('content')
      )
    )
  );

create policy events_staff_insert
  on public.events
  for insert
  to authenticated
  with check (
    public.is_super_admin()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit')
    or public.asa_has_grant('content')
  );

create policy events_staff_update
  on public.events
  for update
  to authenticated
  using (
    public.is_super_admin()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit')
    or public.asa_has_grant('content')
  )
  with check (
    public.is_super_admin()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit')
    or public.asa_has_grant('content')
  );

create policy events_staff_delete
  on public.events
  for delete
  to authenticated
  using (
    public.is_super_admin()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit')
    or public.asa_has_grant('content')
  );

-- ── blogs: one SELECT (public published ∪ content staff) ────────────────
drop policy if exists blogs_public_select on public.blogs;
drop policy if exists blogs_staff_select on public.blogs;

create policy blogs_select
  on public.blogs
  for select
  to anon, authenticated
  using (
    (is_published = true and status = 'published')
    or (
      (select auth.uid()) is not null
      and exists (
        select 1
        from public.staff_profiles sp
        where sp.id = (select auth.uid())
          and sp.is_active = true
          and (
            sp.role = 'BossMich'::profile_role
            or sp.role = 'marketing'::profile_role
            or (
              sp.role = 'assistant_super_admin'::profile_role
              and public.asa_has_grant('content')
            )
          )
      )
    )
  );

-- blogs write was FOR ALL (also matched SELECT) — split so SELECT stays one policy
drop policy if exists blogs_staff_write on public.blogs;

create policy blogs_staff_insert
  on public.blogs
  for insert
  to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('content')
  );

create policy blogs_staff_update
  on public.blogs
  for update
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('content')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('content')
  );

create policy blogs_staff_delete
  on public.blogs
  for delete
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('content')
  );

-- ── app_settings: merge write keys; I/U/D so SELECT stays single policy ─
drop policy if exists "Admins write non-role app_settings" on public.app_settings;
drop policy if exists "Super admin write attendance_roles" on public.app_settings;

create policy app_settings_staff_insert
  on public.app_settings
  for insert
  to authenticated
  with check (
    (key <> 'attendance_roles' and public.is_admin())
    or (key = 'attendance_roles' and public.is_super_admin())
  );

create policy app_settings_staff_update
  on public.app_settings
  for update
  to authenticated
  using (
    (key <> 'attendance_roles' and public.is_admin())
    or (key = 'attendance_roles' and public.is_super_admin())
  )
  with check (
    (key <> 'attendance_roles' and public.is_admin())
    or (key = 'attendance_roles' and public.is_super_admin())
  );

create policy app_settings_staff_delete
  on public.app_settings
  for delete
  to authenticated
  using (
    (key <> 'attendance_roles' and public.is_admin())
    or (key = 'attendance_roles' and public.is_super_admin())
  );
