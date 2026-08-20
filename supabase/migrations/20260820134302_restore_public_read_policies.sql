-- Keep anonymous public reads isolated from staff-only authorization helpers.
-- PostgreSQL may reorder boolean expressions, so an auth.uid() guard inside one
-- mixed-role policy does not guarantee that protected helpers are skipped for anon.

drop policy if exists branches_select on public.branches;
drop policy if exists branches_select_anon on public.branches;
drop policy if exists branches_select_authenticated on public.branches;

create policy branches_select_anon
on public.branches
for select
to anon
using (
  not is_archived
  and (is_active or coming_soon)
);

create policy branches_select_authenticated
on public.branches
for select
to authenticated
using (
  (not is_archived and (is_active or coming_soon))
  or public.is_admin()
  or slug = public.current_user_branch()
  or public.user_has_branch_access(slug)
);

drop policy if exists blogs_select on public.blogs;
drop policy if exists blogs_select_anon on public.blogs;
drop policy if exists blogs_select_authenticated on public.blogs;

create policy blogs_select_anon
on public.blogs
for select
to anon
using (
  is_published = true
  and status = 'published'
);

create policy blogs_select_authenticated
on public.blogs
for select
to authenticated
using (
  (is_published = true and status = 'published')
  or exists (
    select 1
    from public.staff_profiles sp
    where sp.id = (select auth.uid())
      and sp.is_active = true
      and (
        sp.role = 'BossMich'::public.profile_role
        or sp.role = 'marketing'::public.profile_role
        or (
          sp.role = 'assistant_super_admin'::public.profile_role
          and public.asa_has_grant('content')
        )
      )
  )
);

drop policy if exists events_select on public.events;
drop policy if exists events_select_anon on public.events;
drop policy if exists events_select_authenticated on public.events;

create policy events_select_anon
on public.events
for select
to anon
using (is_published = true);

create policy events_select_authenticated
on public.events
for select
to authenticated
using (
  is_published = true
  or public.is_super_admin()
  or public.current_user_role() = 'admin'
  or public.asa_has_grant('planning_edit')
  or public.asa_has_grant('content')
);

drop policy if exists services_select on public.services;
drop policy if exists services_select_anon on public.services;
drop policy if exists services_select_authenticated on public.services;

create policy services_select_anon
on public.services
for select
to anon
using (
  is_active = true
  and is_archived = false
);

create policy services_select_authenticated
on public.services
for select
to authenticated
using (
  (is_active = true and is_archived = false)
  or public.is_staff()
  or public.is_super_admin()
  or public.asa_has_grant('services_merch')
  or public.asa_has_grant('pos')
);

drop policy if exists membership_tiers_select on public.membership_tiers;
drop policy if exists membership_tiers_select_anon on public.membership_tiers;
drop policy if exists membership_tiers_select_authenticated on public.membership_tiers;

create policy membership_tiers_select_anon
on public.membership_tiers
for select
to anon
using (is_active = true);

create policy membership_tiers_select_authenticated
on public.membership_tiers
for select
to authenticated
using (
  is_active = true
  or public.is_super_admin()
  or public.asa_has_grant('memberships')
);

drop policy if exists loyalty_milestones_select on public.loyalty_milestones;
drop policy if exists loyalty_milestones_select_anon on public.loyalty_milestones;
drop policy if exists loyalty_milestones_select_authenticated on public.loyalty_milestones;

create policy loyalty_milestones_select_anon
on public.loyalty_milestones
for select
to anon
using (is_active = true);

create policy loyalty_milestones_select_authenticated
on public.loyalty_milestones
for select
to authenticated
using (
  is_active = true
  or public.is_super_admin()
  or public.asa_has_grant('memberships')
);
