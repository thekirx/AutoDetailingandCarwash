-- Harden function search_path, revoke unintended anon/public SECURITY DEFINER
-- RPC privileges, convert remaining bare auth.uid() checks in planner helpers
-- and plan_proofs storage policies to initPlan subqueries, and safely purge
-- unreferenced archived test branches (`crudtest-*`, `aud-*`, `probe-*`).

begin;

-- 1. Lock search_path on functions flagged by Supabase Security Advisor
do $$
begin
  if to_regprocedure('public.customers_lock_birthday()') is not null then
    alter function public.customers_lock_birthday() set search_path = pg_catalog, public;
  end if;
  if to_regprocedure('public.payroll_period_containing(date)') is not null then
    alter function public.payroll_period_containing(date) set search_path = pg_catalog, public;
  end if;
end $$;

-- 2. Revoke unnecessary public/anon execution on admin RPC & trigger functions
do $$
begin
  if to_regprocedure('public.transfer_branch_stock(uuid, text, text, integer)') is not null then
    revoke all on function public.transfer_branch_stock(uuid, text, text, integer) from public, anon;
    grant execute on function public.transfer_branch_stock(uuid, text, text, integer) to authenticated, service_role;
  end if;

  if to_regprocedure('public.sync_product_total_stock_qty()') is not null then
    revoke all on function public.sync_product_total_stock_qty() from public, anon, authenticated;
    grant execute on function public.sync_product_total_stock_qty() to service_role;
  end if;

  if to_regprocedure('public.apply_coffee_recipe()') is not null then
    revoke all on function public.apply_coffee_recipe() from public, anon, authenticated;
    grant execute on function public.apply_coffee_recipe() to service_role;
  end if;

  if to_regprocedure('public.bookings_friend_referral_before()') is not null then
    revoke all on function public.bookings_friend_referral_before() from public, anon, authenticated;
    grant execute on function public.bookings_friend_referral_before() to service_role;
  end if;

  if to_regprocedure('public.bookings_friend_referral_after()') is not null then
    revoke all on function public.bookings_friend_referral_after() from public, anon, authenticated;
    grant execute on function public.bookings_friend_referral_after() to service_role;
  end if;
end $$;

-- 3. Convert bare auth.uid() in can_edit_planning() and plan_proofs storage policies
create or replace function public.can_edit_planning()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    public.is_super_admin()
    or public.current_user_role() = 'admin'
    or (
      public.current_user_role() = 'assistant_super_admin'
      and coalesce(
        (
          select (sp.permission_grants ->> 'planning_edit')::boolean
          from public.staff_profiles sp
          where sp.id = (select auth.uid())
        ),
        false
      )
    );
$$;

drop policy if exists plan_proofs_select on storage.objects;
create policy plan_proofs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'plan-proofs'
    and (
      public.can_edit_planning()
      or public.is_admin()
      or split_part(name, '/', 1) = (select auth.uid())::text
    )
  );

drop policy if exists plan_proofs_insert on storage.objects;
create policy plan_proofs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plan-proofs'
    and (
      public.can_edit_planning()
      or split_part(name, '/', 1) = (select auth.uid())::text
    )
  );

drop policy if exists plan_proofs_update on storage.objects;
create policy plan_proofs_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'plan-proofs'
    and (
      public.can_edit_planning()
      or split_part(name, '/', 1) = (select auth.uid())::text
    )
  )
  with check (
    bucket_id = 'plan-proofs'
    and (
      public.can_edit_planning()
      or split_part(name, '/', 1) = (select auth.uid())::text
    )
  );

-- 4. Purge unreferenced archived QA/test-residue rows from branches
delete from public.branches br
 where br.slug ~ '^(crudtest-|aud-|probe-)'
   and coalesce(br.is_archived, false) = true
   and not exists (select 1 from public.bookings b where b.branch = br.slug)
   and not exists (select 1 from public.sales s where s.branch = br.slug)
   and not exists (select 1 from public.staff_branch_assignments sba where sba.branch_slug = br.slug)
   and not exists (select 1 from public.product_branch_stock pbs where pbs.branch_slug = br.slug)
   and not exists (select 1 from public.expenses e where e.branch = br.slug)
   and not exists (select 1 from public.daily_sheets ds where ds.branch = br.slug)
   and not exists (select 1 from public.shift_close_reports scr where scr.branch = br.slug);

commit;
