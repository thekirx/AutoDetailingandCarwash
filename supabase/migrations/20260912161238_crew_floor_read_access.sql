-- Crew may observe their assigned branch Floor, Queue, attendance roster, and busy crew.
-- Mutations remain governed by the existing manager/self policies.
begin;

create policy crew_floor_bookings_select
  on public.bookings
  for select
  to authenticated
  using (
    public.current_user_role() = 'staff'
    and public.user_has_branch_access(branch)
  );

create policy crew_floor_staff_profiles_select
  on public.staff_profiles
  for select
  to authenticated
  using (
    public.current_user_role() = 'staff'
    and role = 'staff'
    and public.user_has_branch_access(branch_slug)
  );

create policy crew_floor_attendance_select
  on public.staff_attendance
  for select
  to authenticated
  using (
    public.current_user_role() = 'staff'
    and public.user_has_branch_access(branch_slug)
  );

create or replace function public.can_read_queue_assignment(p_staff_id uuid, p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select
    p_staff_id = (select auth.uid())
    or public.is_admin()
    or (
      public.current_user_role() in ('team_lead', 'staff')
      and exists (
        select 1
        from public.bookings b
        where b.id = p_booking_id
          and public.user_has_branch_access(b.branch)
      )
    );
$$;

revoke all on function public.can_read_queue_assignment(uuid, uuid) from public, anon;
grant execute on function public.can_read_queue_assignment(uuid, uuid) to authenticated;

commit;
