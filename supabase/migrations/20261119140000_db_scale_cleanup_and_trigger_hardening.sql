-- =============================================================================
-- Database Scale Cleanup, Trigger Hardening & Permissive Policy Consolidation
-- =============================================================================
-- 1. Drop redundant prefix index public.bookings_schedule_idx (strict 1-column
--    prefix of bookings_scheduled_branch_idx with identical partial predicate).
-- 2. Revoke direct EXECUTE on SECURITY DEFINER trigger function
--    public.log_queue_status_change() from public, anon, and authenticated.
-- 3. Consolidate 12 multiple_permissive_policies SELECT pairs (merging
--    investor_read_* and split own/staff/customer SELECT policies into single
--    initplan-wrapped SELECT policies per table) while preserving required
--    policy names and exact role/branch row visibility.
-- 4. Wrap public.can_manage_site_content() on blogs_select_authenticated in an
--    initplan scalar subquery for stable query planning.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_super_admin'
  ) then
    raise exception 'public.is_super_admin() is missing — required RLS helper must exist';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_investor'
  ) then
    raise exception 'public.is_investor() is missing — required RLS helper must exist';
  end if;

  if to_regclass('public.bookings') is null
     or to_regclass('public.daily_sheets') is null
     or to_regclass('public.blogs') is null then
    raise exception 'Core application tables are missing';
  end if;
end
$$;

-- 1. Drop redundant prefix index on bookings (covered by bookings_scheduled_branch_idx)
drop index if exists public.bookings_schedule_idx;

-- 2. Lock down SECURITY DEFINER trigger function direct execution
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'log_queue_status_change'
  ) then
    revoke all on function public.log_queue_status_change() from public, anon, authenticated;
  end if;
end
$$;

-- 3. Consolidate multiple permissive SELECT policies per table

-- 3a. bookings
drop policy if exists investor_read_bookings on public.bookings;
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (select public.is_staff())
    or (select public.current_user_role()) = 'sales'
    or (
      (select public.current_user_role()) = any (array['detailer', 'marketing'])
      and branch = any ((select public.accessible_branch_slugs())::text[])
    )
    or branch = any ((select public.manageable_branch_slugs())::text[])
    or public.staff_is_assigned_to_booking(id)
    or ((select public.is_investor()) and public.user_has_branch_access(branch))
  );

-- 3b. daily_sheets
drop policy if exists investor_read_daily_sheets on public.daily_sheets;
drop policy if exists daily_sheets_select on public.daily_sheets;
create policy daily_sheets_select on public.daily_sheets
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.asa_has_grant('finance_view'))
    or (
      (select public.current_user_role()) = any (array['admin', 'assistant_super_admin'])
      and public.user_has_branch_access(branch)
    )
    or ((select public.is_investor()) and public.user_has_branch_access(branch))
  );

-- 3c. daily_sheet_lines (daily_sheets RLS already enforces investor branch visibility)
drop policy if exists investor_read_daily_sheet_lines on public.daily_sheet_lines;

-- 3d. payroll_runs
drop policy if exists investor_read_payroll_runs on public.payroll_runs;
drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs
  for select to authenticated
  using (
    (select public.is_super_admin())
    or ((select public.is_assistant_super_admin()) and (select public.asa_has_grant('finance_view')))
    or exists (
      select 1
      from public.payroll_run_lines l
      where l.run_id = payroll_runs.id
        and l.staff_id = (select auth.uid())
    )
    or ((select public.is_investor()) and public.user_has_branch_access(branch))
  );

-- 3e. pos_handoffs
drop policy if exists investor_read_pos_handoffs on public.pos_handoffs;
drop policy if exists "Authorized payment users can read handoffs" on public.pos_handoffs;
create policy "Authorized payment users can read handoffs" on public.pos_handoffs
  for select to authenticated
  using (
    (
      public.user_has_branch_access(branch)
      and ((select public.is_admin()) or (select public.current_user_role()) = 'team_lead')
    )
    or ((select public.is_investor()) and public.user_has_branch_access(branch))
  );

-- 3f. queue_assignments
drop policy if exists investor_read_queue_assignments on public.queue_assignments;
drop policy if exists "Authorized users can read queue assignments" on public.queue_assignments;
create policy "Authorized users can read queue assignments" on public.queue_assignments
  for select to authenticated
  using (
    public.can_read_queue_assignment(staff_id, booking_id)
    or (
      (select public.is_investor())
      and exists (
        select 1
        from public.bookings b
        where b.id = queue_assignments.booking_id
          and public.user_has_branch_access(b.branch)
      )
    )
  );

-- 3g. queue_events
drop policy if exists investor_read_queue_events on public.queue_events;
drop policy if exists "Queue managers can read branch events" on public.queue_events;
create policy "Queue managers can read branch events" on public.queue_events
  for select to authenticated
  using (
    branch = any ((select public.manageable_branch_slugs())::text[])
    or ((select public.is_investor()) and public.user_has_branch_access(branch))
  );

-- 3h. shift_close_reports
drop policy if exists investor_read_shift_close_reports on public.shift_close_reports;
drop policy if exists shift_close_reports_select on public.shift_close_reports;
create policy shift_close_reports_select on public.shift_close_reports
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (select public.asa_has_grant('finance_view'))
    or ((select public.current_user_role()) = 'admin' and public.user_has_branch_access(branch))
    or ((select public.is_investor()) and public.user_has_branch_access(branch))
  );

-- 3i. customer_referral_rewards
drop policy if exists customer_referral_rewards_own_read on public.customer_referral_rewards;
drop policy if exists customer_referral_rewards_staff_read on public.customer_referral_rewards;
create policy customer_referral_rewards_select on public.customer_referral_rewards
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (select public.is_staff())
  );

-- 3j. customer_referrals
drop policy if exists customer_referrals_own_read on public.customer_referrals;
drop policy if exists customer_referrals_staff_read on public.customer_referrals;
create policy customer_referrals_select on public.customer_referrals
  for select to authenticated
  using (
    referrer_id = (select auth.uid())
    or friend_id = (select auth.uid())
    or (select public.is_staff())
  );

-- 3k. promo_voucher_redemptions
drop policy if exists promo_voucher_redemptions_own_read on public.promo_voucher_redemptions;
drop policy if exists promo_voucher_redemptions_staff_read on public.promo_voucher_redemptions;
create policy promo_voucher_redemptions_select on public.promo_voucher_redemptions
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
    )
  );

-- 3l. promo_vouchers
drop policy if exists promo_vouchers_customer_read on public.promo_vouchers;
drop policy if exists promo_vouchers_staff_read on public.promo_vouchers;
create policy promo_vouchers_select on public.promo_vouchers
  for select to authenticated
  using (
    (
      is_active = true
      and exists (
        select 1
        from public.customers c
        where c.id = (select auth.uid())
          and coalesce(c.is_archived, false) = false
      )
    )
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
    )
  );

-- 4. Initplan-wrap can_manage_site_content() on blogs_select_authenticated
--    and drop stale legacy blogs_select_anon policy (superseded by blogs_public_select).
drop policy if exists blogs_select_anon on public.blogs;
drop policy if exists blogs_select_authenticated on public.blogs;
create policy blogs_select_authenticated on public.blogs
  for select to authenticated
  using (
    (status = 'published' and is_published = true and (published_at is null or published_at <= now()))
    or (status = 'scheduled' and published_at is not null and published_at <= now())
    or (select public.can_manage_site_content())
  );

commit;
