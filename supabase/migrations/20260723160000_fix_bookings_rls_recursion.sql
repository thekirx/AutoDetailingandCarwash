-- Fix bookings ↔ queue_assignments RLS recursion + tighten services writes to admins.
-- Root cause: bookings policy SELECT EXISTS queue_assignments, while queue_assignments
-- SELECT EXISTS bookings → infinite recursion under RLS.
-- security-rls: SECURITY DEFINER helpers bypass RLS for the cross-check only.

create or replace function public.staff_is_assigned_to_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select exists (
    select 1
    from public.queue_assignments qa
    where qa.booking_id = p_booking_id
      and qa.staff_id = (select auth.uid())
  );
$$;

revoke all on function public.staff_is_assigned_to_booking(uuid) from public, anon;
grant execute on function public.staff_is_assigned_to_booking(uuid) to authenticated;

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
      public.is_team_lead()
      and exists (
        select 1
        from public.bookings b
        where b.id = p_booking_id
          and b.branch = public.current_user_branch()
      )
    );
$$;

revoke all on function public.can_read_queue_assignment(uuid, uuid) from public, anon;
grant execute on function public.can_read_queue_assignment(uuid, uuid) to authenticated;

drop policy if exists "Staff can read assigned bookings" on public.bookings;
create policy "Staff can read assigned bookings"
  on public.bookings for select to authenticated
  using (public.staff_is_assigned_to_booking(id));

drop policy if exists "Authorized users can read queue assignments" on public.queue_assignments;
create policy "Authorized users can read queue assignments"
  on public.queue_assignments for select to authenticated
  using (public.can_read_queue_assignment(staff_id, booking_id));

-- Services catalog: admin/BossMich only (UI already gates canManageServices).
drop policy if exists "Staff can insert services" on public.services;
drop policy if exists "Staff can update services" on public.services;
-- Keep "Admin has full access to services" (is_admin includes BossMich).
-- Keep public/staff SELECT policies for reading the catalog.
