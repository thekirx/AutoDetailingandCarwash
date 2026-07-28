-- Fix C1–C4: assignment writes, staff geo clock-in, branch-scoped manage, no RLS recursion
begin;

-- C3: branch managers only for branches they can access (not every is_admin() site)
create or replace function public.can_manage_branch(target_branch text)
returns boolean
language sql
stable
security definer
set search_path to pg_catalog, public
as $$
  select
    target_branch is not null
    and public.current_user_role() in ('admin', 'BossMich', 'assistant_super_admin', 'team_lead')
    and public.user_has_branch_access(target_branch);
$$;

revoke all on function public.can_manage_branch(text) from public, anon;
grant execute on function public.can_manage_branch(text) to authenticated;

-- C1: sync assignments via SECURITY DEFINER; allow ASA; branch via user_has_branch_access
create or replace function public.sync_queue_assignments(
  input_booking_id uuid,
  input_staff_ids uuid[]
)
returns table (
  assignment_id uuid,
  booking_id uuid,
  staff_id uuid,
  started_at timestamptz,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  target_booking public.bookings%rowtype;
  selected_staff_ids uuid[];
  current_staff_ids uuid[];
  invalid_staff_ids uuid[];
  mutation_time timestamptz := clock_timestamp();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  -- Align with canEditQueueOperations: SA, ASA, team_lead (not branch admin)
  if caller_role not in ('BossMich', 'team_lead', 'assistant_super_admin') then
    raise exception using errcode = '42501',
      message = 'Assignment synchronization is restricted to BossMich, ASA, or team lead';
  end if;

  select b.*
  into target_booking
  from public.bookings b
  where b.id = input_booking_id
    and not coalesce(b.is_archived, false)
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  -- SA / ASA branches_all pass user_has_branch_access for any branch
  if not public.user_has_branch_access(target_booking.branch) then
    raise exception using errcode = '42501',
      message = 'You do not have access to synchronize assignments for this branch';
  end if;

  select coalesce(array_agg(distinct selected_id order by selected_id), array[]::uuid[])
  into selected_staff_ids
  from unnest(coalesce(input_staff_ids, array[]::uuid[])) selected_id
  where selected_id is not null;

  select array_agg(selected_id order by selected_id)
  into invalid_staff_ids
  from unnest(selected_staff_ids) selected_id
  left join public.staff_profiles sp on sp.id = selected_id
  where sp.id is null
     or sp.role::text not in ('staff', 'team_lead')
     or not coalesce(sp.is_active, false)
     or coalesce(sp.is_archived, false)
     or (
       sp.branch_slug is distinct from target_booking.branch
       and not exists (
         select 1 from public.staff_branch_assignments sba
         where sba.staff_id = selected_id
           and sba.branch_slug = target_booking.branch
       )
     );

  if invalid_staff_ids is not null then
    raise exception using
      errcode = '23514',
      message = 'Every selected crew member must be active staff or team lead assigned to the booking branch';
  end if;

  select coalesce(array_agg(qa.staff_id order by qa.staff_id), array[]::uuid[])
  into current_staff_ids
  from public.queue_assignments qa
  where qa.booking_id = input_booking_id
    and qa.status = 'active';

  if target_booking.status::text not in ('waiting', 'in_progress') then
    if coalesce(current_staff_ids, array[]::uuid[]) = coalesce(selected_staff_ids, array[]::uuid[]) then
      return query
      select qa.id, qa.booking_id, qa.staff_id, qa.started_at, qa.status::text, qa.created_at
      from public.queue_assignments qa
      where qa.booking_id = input_booking_id
        and qa.status = 'active'
      order by qa.created_at, qa.id;
      return;
    end if;
    raise exception using
      errcode = '23514',
      message = 'Assignments can only change while a booking is waiting or in progress';
  end if;

  insert into public.queue_assignments (
    booking_id, staff_id, assigned_by, status, started_at, created_at, task_name
  )
  select target_booking.id,
    selected_id,
    caller_id,
    'active',
    case when target_booking.status::text = 'in_progress' then mutation_time else null end,
    mutation_time,
    'Queue service'
  from unnest(selected_staff_ids) selected_id
  where not exists (
    select 1 from public.queue_assignments qa
    where qa.booking_id = target_booking.id
      and qa.staff_id = selected_id
      and qa.status = 'active'
  );

  update public.queue_assignments qa
  set status = 'released',
      released_at = coalesce(qa.released_at, mutation_time),
      completed_at = coalesce(qa.completed_at, mutation_time)
  where qa.booking_id = input_booking_id
    and qa.status = 'active'
    and not (qa.staff_id = any(selected_staff_ids));

  update public.bookings b
  set assigned_staff_id = selected_staff_ids[1],
      updated_at = mutation_time
  where b.id = input_booking_id;

  return query
  select qa.id, qa.booking_id, qa.staff_id, qa.started_at, qa.status::text, qa.created_at
  from public.queue_assignments qa
  where qa.booking_id = input_booking_id
    and qa.status = 'active'
  order by qa.created_at, qa.id;
end;
$$;

revoke all on function public.sync_queue_assignments(uuid, uuid[]) from public, anon;
grant execute on function public.sync_queue_assignments(uuid, uuid[]) to authenticated;

-- My Tasks: staff may update their own assignment row (acknowledge / start)
grant select, insert, update on public.queue_assignments to authenticated;

drop policy if exists "Staff can update own queue assignments" on public.queue_assignments;
create policy "Staff can update own queue assignments"
on public.queue_assignments for update to authenticated
using (staff_id = (select auth.uid()))
with check (staff_id = (select auth.uid()));

-- Managers may also update assignments in branches they manage (non-FOR-ALL)
drop policy if exists "Managers can update queue assignments" on public.queue_assignments;
create policy "Managers can update queue assignments"
on public.queue_assignments for update to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = queue_assignments.booking_id
      and public.can_manage_branch(b.branch)
  )
)
with check (
  exists (
    select 1 from public.bookings b
    where b.id = queue_assignments.booking_id
      and public.can_manage_branch(b.branch)
  )
);

-- C2: staff self geo clock-in/out (own row only)
drop policy if exists "Staff can insert own attendance" on public.staff_attendance;
create policy "Staff can insert own attendance"
on public.staff_attendance for insert to authenticated
with check (
  staff_id = (select auth.uid())
  and public.user_has_branch_access(branch_slug)
);

drop policy if exists "Staff can update own attendance" on public.staff_attendance;
create policy "Staff can update own attendance"
on public.staff_attendance for update to authenticated
using (staff_id = (select auth.uid()))
with check (
  staff_id = (select auth.uid())
  and public.user_has_branch_access(branch_slug)
);

commit;
