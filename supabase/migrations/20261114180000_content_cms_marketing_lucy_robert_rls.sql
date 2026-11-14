-- Allow Super Admin (BossMich), Marketing, and Assistant Super Admins (including Lucy & Robert)
-- to create, edit, publish, and delete blogs, events, and content-media photos/videos.

create or replace function public.can_manage_site_content()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or public.current_user_role() = 'marketing'
    or public.asa_has_grant('content')
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role = 'assistant_super_admin'::public.profile_role
        and (
          lower(coalesce(sp.full_name, '')) ~ '(lucy|luci|robert)'
          or lower(coalesce(sp.login_email, '')) ~ '(lucy|assistant|robert)'
        )
    );
$$;

revoke all on function public.can_manage_site_content() from public, anon;
grant execute on function public.can_manage_site_content() to authenticated, service_role;

-- ── blogs ──────────────────────────────────────────────────────────────────
drop policy if exists blogs_select_authenticated on public.blogs;
create policy blogs_select_authenticated
  on public.blogs
  for select
  to authenticated
  using (
    (is_published = true and status = 'published')
    or public.can_manage_site_content()
  );

drop policy if exists blogs_staff_insert on public.blogs;
create policy blogs_staff_insert
  on public.blogs
  for insert
  to authenticated
  with check (public.can_manage_site_content());

drop policy if exists blogs_staff_update on public.blogs;
create policy blogs_staff_update
  on public.blogs
  for update
  to authenticated
  using (public.can_manage_site_content())
  with check (public.can_manage_site_content());

drop policy if exists blogs_staff_delete on public.blogs;
create policy blogs_staff_delete
  on public.blogs
  for delete
  to authenticated
  using (public.can_manage_site_content());

-- ── events ─────────────────────────────────────────────────────────────────
drop policy if exists events_select_authenticated on public.events;
create policy events_select_authenticated
  on public.events
  for select
  to authenticated
  using (
    is_published = true
    or public.can_manage_site_content()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit')
  );

drop policy if exists events_staff_insert on public.events;
create policy events_staff_insert
  on public.events
  for insert
  to authenticated
  with check (
    public.can_manage_site_content()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit')
  );

drop policy if exists events_staff_update on public.events;
create policy events_staff_update
  on public.events
  for update
  to authenticated
  using (
    public.can_manage_site_content()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit')
  )
  with check (
    public.can_manage_site_content()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit')
  );

drop policy if exists events_staff_delete on public.events;
create policy events_staff_delete
  on public.events
  for delete
  to authenticated
  using (
    public.can_manage_site_content()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit')
  );

-- ── storage.objects (content-media bucket) ─────────────────────────────────
drop policy if exists content_media_staff_write on storage.objects;
create policy content_media_staff_write
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'content-media'
    and (
      public.can_manage_site_content()
      or public.current_user_role() = 'admin'
      or public.asa_has_grant('planning_edit')
    )
  );

drop policy if exists content_media_staff_update on storage.objects;
create policy content_media_staff_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'content-media'
    and (
      public.can_manage_site_content()
      or public.current_user_role() = 'admin'
      or public.asa_has_grant('planning_edit')
    )
  );

drop policy if exists content_media_staff_delete on storage.objects;
create policy content_media_staff_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'content-media'
    and (
      public.can_manage_site_content()
      or public.current_user_role() = 'admin'
      or public.asa_has_grant('planning_edit')
    )
  );

