-- Daily-flow reads (Floor Board, finance, queue) evaluated role/branch helpers once per row (0.3-0.8 ms each),
-- so a month of sales or queue events took seconds and the queue_events read timed out (500) for ASA.
-- Same access rules: no-arg helpers are wrapped in (select ...) so they run once per statement, and per-row
-- branch checks compare against the caller's branch list. Every branch column below references branches(slug),
-- so `branch = any(<slugs passing the helper>)` is equivalent to calling the helper on the row's branch.

create or replace function public.accessible_branch_slugs()
returns text[]
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(array_agg(b.slug), '{}') from public.branches b where public.user_has_branch_access(b.slug);
$$;

create or replace function public.manageable_branch_slugs()
returns text[]
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(array_agg(b.slug), '{}') from public.branches b where public.can_manage_branch(b.slug);
$$;

revoke all on function public.accessible_branch_slugs() from public, anon;
revoke all on function public.manageable_branch_slugs() from public, anon;
grant execute on function public.accessible_branch_slugs() to authenticated;
grant execute on function public.manageable_branch_slugs() to authenticated;

drop policy if exists "Queue managers can read branch events" on public.queue_events;
create policy "Queue managers can read branch events" on public.queue_events
  for select to authenticated
  using (branch = any ((select public.manageable_branch_slugs())::text[]));

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.asa_has_grant('finance_view'))
    or ((select public.current_user_role()) in ('admin', 'marketing', 'investor')
        and branch = any ((select public.accessible_branch_slugs())::text[]))
    or ((select public.current_user_role()) = 'team_lead' and branch = (select public.current_user_branch()))
    or (select public.current_user_role()) in ('sales', 'cashier')
  );

-- staff_is_assigned_to_booking(id) is still per row; it stays last so managers short-circuit before it.
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (select public.current_user_role()) = 'sales'
    or ((select public.current_user_role()) in ('detailer', 'marketing')
        and branch = any ((select public.accessible_branch_slugs())::text[]))
    or branch = any ((select public.manageable_branch_slugs())::text[])
    or public.staff_is_assigned_to_booking(id)
  );
