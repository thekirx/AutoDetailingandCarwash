-- Investor: read-only, branch-scoped view of the floor board, the POS day, Daily Sheets and the books.
-- Branch scope = staff_profiles.branch_slug + staff_branch_assignments (user_has_branch_access); no branch = no rows.
-- SELECT only: investors get no insert / update / delete policy and no RPC grant here.

create or replace function public.is_investor()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select public.current_user_role() = 'investor';
$$;

revoke all on function public.is_investor() from public, anon;
grant execute on function public.is_investor() to authenticated;

drop policy if exists investor_read_bookings on public.bookings;
create policy investor_read_bookings on public.bookings
  for select to authenticated
  using ((select public.is_investor()) and public.user_has_branch_access(branch));

drop policy if exists investor_read_pos_handoffs on public.pos_handoffs;
create policy investor_read_pos_handoffs on public.pos_handoffs
  for select to authenticated
  using ((select public.is_investor()) and public.user_has_branch_access(branch));

drop policy if exists investor_read_queue_events on public.queue_events;
create policy investor_read_queue_events on public.queue_events
  for select to authenticated
  using ((select public.is_investor()) and public.user_has_branch_access(branch));

drop policy if exists investor_read_queue_assignments on public.queue_assignments;
create policy investor_read_queue_assignments on public.queue_assignments
  for select to authenticated
  using (
    (select public.is_investor())
    and exists (select 1 from public.bookings b where b.id = queue_assignments.booking_id and public.user_has_branch_access(b.branch))
  );

drop policy if exists investor_read_daily_sheets on public.daily_sheets;
create policy investor_read_daily_sheets on public.daily_sheets
  for select to authenticated
  using ((select public.is_investor()) and public.user_has_branch_access(branch));

drop policy if exists investor_read_daily_sheet_lines on public.daily_sheet_lines;
create policy investor_read_daily_sheet_lines on public.daily_sheet_lines
  for select to authenticated
  using (
    (select public.is_investor())
    and exists (select 1 from public.daily_sheets s where s.id = daily_sheet_lines.sheet_id and public.user_has_branch_access(s.branch))
  );

drop policy if exists investor_read_shift_close_reports on public.shift_close_reports;
create policy investor_read_shift_close_reports on public.shift_close_reports
  for select to authenticated
  using ((select public.is_investor()) and public.user_has_branch_access(branch));

drop policy if exists investor_read_payroll_runs on public.payroll_runs;
create policy investor_read_payroll_runs on public.payroll_runs
  for select to authenticated
  using ((select public.is_investor()) and public.user_has_branch_access(branch));

drop policy if exists investor_read_daily_sheet_receipts on storage.objects;
create policy investor_read_daily_sheet_receipts on storage.objects
  for select to authenticated
  using (
    bucket_id = 'daily-sheet-receipts'
    and (select public.is_investor())
    and public.user_has_branch_access(split_part(name, '/', 1))
  );
