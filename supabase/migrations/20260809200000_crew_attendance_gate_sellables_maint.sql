-- Enforce timed-in (present/late) before queue crew assign + product sellable tags + ceramic maintenance.

drop function if exists public.sync_queue_assignments(uuid, uuid[]);

-- 1) Attendance gate on sync_queue_assignments
create or replace function public.sync_queue_assignments(
  input_booking_id uuid,
  input_staff_ids uuid[]
)
returns table (
  id uuid,
  booking_id uuid,
  staff_id uuid,
  started_at timestamptz,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  target_booking public.bookings%rowtype;
  selected_staff_ids uuid[];
  current_staff_ids uuid[];
  invalid_staff_ids uuid[];
  not_timed_in_ids uuid[];
  mutation_time timestamptz := clock_timestamp();
  today_manila date := (timezone('Asia/Manila', now()))::date;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('BossMich', 'team_lead', 'assistant_super_admin') then
    raise exception using errcode = '42501',
      message = 'Assignment synchronization is restricted to BossMich, ASA, or team lead';
  end if;

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

  -- Crew must be timed in today (present or late) on the booking branch.
  select array_agg(selected_id order by selected_id)
  into not_timed_in_ids
  from unnest(selected_staff_ids) selected_id
  where not exists (
    select 1
    from public.staff_attendance sa
    where sa.staff_id = selected_id
      and sa.attendance_date = today_manila
      and sa.status in ('present', 'late')
      and (
        sa.branch_slug is null
        or sa.branch_slug = target_booking.branch
      )
  );

  if not_timed_in_ids is not null then
    raise exception using
      errcode = '23514',
      message = 'Crew must time in (present or late) before they can be assigned to a job';
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

-- 2) Sellable tags for POS (coffee, accessories, scents, loyalty freebies)
alter table public.products
  add column if not exists tags text[] not null default '{}';

create index if not exists products_tags_gin_idx on public.products using gin (tags);

comment on column public.products.tags is
  'POS sellable tags: coffee, free_coffee, free_service, accessories, scents, merch — Branch Admin may only add tagged sellables.';

-- 3) Ceramic / PPF maintenance schedule (6-month reminders)
create table if not exists public.vehicle_maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  service_slug text not null,
  plate_number text,
  customer_phone text,
  customer_name text,
  coated_at date not null,
  last_maintenance_at date,
  next_due_at date not null,
  branch_slug text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'notified', 'completed', 'cancelled')),
  last_notified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_maint_next_due_idx
  on public.vehicle_maintenance_schedules (next_due_at)
  where status in ('scheduled', 'notified');

create index if not exists vehicle_maint_plate_idx
  on public.vehicle_maintenance_schedules (plate_number);

alter table public.vehicle_maintenance_schedules enable row level security;

drop policy if exists vehicle_maint_select on public.vehicle_maintenance_schedules;
create policy vehicle_maint_select on public.vehicle_maintenance_schedules
  for select to authenticated
  using (
    public.current_user_role() in ('BossMich', 'assistant_super_admin', 'admin', 'team_lead', 'sales', 'marketing')
  );

drop policy if exists vehicle_maint_write on public.vehicle_maintenance_schedules;
create policy vehicle_maint_write on public.vehicle_maintenance_schedules
  for all to authenticated
  using (
    public.current_user_role() in ('BossMich', 'assistant_super_admin', 'admin', 'sales')
  )
  with check (
    public.current_user_role() in ('BossMich', 'assistant_super_admin', 'admin', 'sales')
  );

grant select, insert, update, delete on public.vehicle_maintenance_schedules to authenticated;
