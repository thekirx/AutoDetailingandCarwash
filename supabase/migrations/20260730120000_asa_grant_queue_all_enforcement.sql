-- ASA grant enforcement: queue_all on sync_queue_assignments; helper for JSON grants
begin;

create or replace function public.asa_has_grant(grant_key text)
returns boolean
language sql
stable
security definer
set search_path to pg_catalog, public
as $$
  select
    public.is_assistant_super_admin()
    and coalesce(
      (
        select case
          when sp.permission_grants ? grant_key
            then (sp.permission_grants ->> grant_key)::boolean
          -- match client DEFAULT_ASSISTANT_GRANTS: missing key = true except denied-by-default keys
          when grant_key in ('finance_write', 'planning_edit', 'rbac_edit') then false
          else true
        end
        from public.staff_profiles sp
        where sp.id = (select auth.uid())
          and coalesce(sp.is_active, false)
          and not coalesce(sp.is_archived, false)
        limit 1
      ),
      false
    );
$$;

revoke all on function public.asa_has_grant(text) from public, anon;
grant execute on function public.asa_has_grant(text) to authenticated;

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
  if caller_role not in ('BossMich', 'team_lead', 'assistant_super_admin') then
    raise exception using errcode = '42501',
      message = 'Assignment synchronization is restricted to BossMich, ASA, or team lead';
  end if;

  -- ASA must hold queue_all (defaults true; explicit false blocks)
  if caller_role = 'assistant_super_admin' and not public.asa_has_grant('queue_all') then
    raise exception using errcode = '42501',
      message = 'Assignment sync requires the queue_all grant';
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

commit;
