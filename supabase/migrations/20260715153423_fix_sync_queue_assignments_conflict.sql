begin;

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
set search_path = pg_catalog, public
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
  if caller_role not in ('admin', 'BossMich', 'team_lead') then
    raise exception using errcode = '42501', message = 'Assignment synchronization is restricted to BossMich, admin, or team lead';
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

  if caller_role = 'team_lead'
     and public.current_user_branch() is distinct from target_booking.branch then
    raise exception using errcode = '42501', message = 'Team leads may only synchronize assignments in their own branch';
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
     or sp.role::text <> 'staff'
     or not coalesce(sp.is_active, false)
     or coalesce(sp.is_archived, false)
     or sp.branch_slug is distinct from target_booking.branch;

  if invalid_staff_ids is not null then
    raise exception using
      errcode = '23514',
      message = 'Every selected crew member must be active, unarchived staff in the booking branch';
  end if;

  select coalesce(array_agg(qa.staff_id order by qa.staff_id), array[]::uuid[])
  into current_staff_ids
  from public.queue_assignments qa
  where qa.booking_id = input_booking_id
    and qa.status = 'active';

  if target_booking.status::text not in ('waiting', 'in_progress') then
    if current_staff_ids = selected_staff_ids then
      return query
      select qa.id, qa.booking_id, qa.staff_id, qa.started_at, qa.status, qa.created_at
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
    booking_id, staff_id, assigned_by, status, started_at, created_at
  )
  select target_booking.id,
    selected_id,
    caller_id,
    'active',
    case when target_booking.status::text = 'in_progress' then mutation_time else null end,
    mutation_time
  from unnest(selected_staff_ids) selected_id
  on conflict do nothing;

  update public.queue_assignments qa
  set status = 'cancelled',
      cancelled_at = coalesce(qa.cancelled_at, mutation_time),
      cancelled_by = caller_id,
      cancellation_reason = coalesce(qa.cancellation_reason, 'Removed from selected crew')
  where qa.booking_id = input_booking_id
    and qa.status = 'active'
    and not (qa.staff_id = any(selected_staff_ids));

  return query
  select qa.id, qa.booking_id, qa.staff_id, qa.started_at, qa.status, qa.created_at
  from public.queue_assignments qa
  where qa.booking_id = input_booking_id
    and qa.status = 'active'
  order by qa.created_at, qa.id;
end;
$$;

revoke all on function public.sync_queue_assignments(uuid, uuid[]) from public, anon;
grant execute on function public.sync_queue_assignments(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';

commit;
