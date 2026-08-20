-- Restore public read access on the six tables the public site depends on.
--
-- The *_rls_merge changes applied 2026-08-20 collapsed each table's separate
-- anon/authenticated SELECT policies into one combined policy. Those combined
-- predicates call staff-only helpers (current_user_role, current_user_branch,
-- is_staff, asa_has_grant, ...) that `anon` has no EXECUTE privilege on.
-- Postgres does not guarantee OR short-circuits, so the planner reaches the
-- staff branch even for anonymous visitors and the whole query fails with
-- "permission denied for function ...". Every public page reading these tables
-- went blank.
--
-- Splitting by role keeps the staff helpers out of the anon predicate entirely,
-- which is how these policies were originally written (see
-- 20260723170000_branch_geo_coming_soon.sql). This reintroduces the
-- "multiple permissive policies" performance advisory on purpose: satisfying
-- that advisory is what caused the outage.

-- branches ------------------------------------------------------------------
drop policy if exists branches_select on public.branches;

create policy branches_select_anon on public.branches
  for select to anon
  using (not is_archived and (is_active or coming_soon));

create policy branches_select_authenticated on public.branches
  for select to authenticated
  using (
    (not is_archived and (is_active or coming_soon))
    or is_admin()
    or slug = current_user_branch()
    or user_has_branch_access(slug)
  );

-- events --------------------------------------------------------------------
drop policy if exists events_select on public.events;

create policy events_select_anon on public.events
  for select to anon
  using (is_published = true);

create policy events_select_authenticated on public.events
  for select to authenticated
  using (
    is_published = true
    or is_super_admin()
    or current_user_role() = 'admin'
    or asa_has_grant('planning_edit')
    or asa_has_grant('content')
  );

-- blogs ---------------------------------------------------------------------
drop policy if exists blogs_select on public.blogs;

create policy blogs_select_anon on public.blogs
  for select to anon
  using (is_published = true and status = 'published');

create policy blogs_select_authenticated on public.blogs
  for select to authenticated
  using (
    (is_published = true and status = 'published')
    or exists (
      select 1 from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and (
          sp.role = 'BossMich'::profile_role
          or sp.role = 'marketing'::profile_role
          or (sp.role = 'assistant_super_admin'::profile_role and asa_has_grant('content'))
        )
    )
  );

-- services ------------------------------------------------------------------
drop policy if exists services_select on public.services;

create policy services_select_anon on public.services
  for select to anon
  using (is_active = true and is_archived = false);

create policy services_select_authenticated on public.services
  for select to authenticated
  using (
    (is_active = true and is_archived = false)
    or is_staff()
    or is_super_admin()
    or asa_has_grant('services_merch')
    or asa_has_grant('pos')
  );

-- membership_tiers ----------------------------------------------------------
drop policy if exists membership_tiers_select on public.membership_tiers;

create policy membership_tiers_select_anon on public.membership_tiers
  for select to anon
  using (is_active = true);

create policy membership_tiers_select_authenticated on public.membership_tiers
  for select to authenticated
  using (is_active = true or is_super_admin() or asa_has_grant('memberships'));

-- loyalty_milestones --------------------------------------------------------
drop policy if exists loyalty_milestones_select on public.loyalty_milestones;

create policy loyalty_milestones_select_anon on public.loyalty_milestones
  for select to anon
  using (is_active = true);

create policy loyalty_milestones_select_authenticated on public.loyalty_milestones
  for select to authenticated
  using (is_active = true or is_super_admin() or asa_has_grant('memberships'));
