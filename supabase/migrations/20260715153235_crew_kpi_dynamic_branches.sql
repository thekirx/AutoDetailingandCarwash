begin;

lock table public.queue_assignments,
  public.bookings,
  public.branches,
  public.queue_events,
  public.pos_handoffs,
  public.vehicles
in share row exclusive mode;

do $preflight$
declare
  invalid_statuses text;
  invalid_values text;
begin
  select string_agg(distinct coalesce(status, '<null>'), ', ' order by coalesce(status, '<null>'))
  into invalid_statuses
  from public.queue_assignments
  where status is null
     or status not in ('active', 'released', 'cancelled', 'assigned', 'in_progress', 'completed');

  if invalid_statuses is not null then
    raise exception 'Unsupported public.queue_assignments.status value(s): %', invalid_statuses;
  end if;

  select string_agg(distinct b.branch, ', ' order by b.branch)
  into invalid_values
  from public.bookings b
  left join public.branches br on br.slug = b.branch
  where b.branch is not null and br.slug is null;
  if invalid_values is not null then
    raise exception 'Unknown branch value(s) in public.bookings.branch: %', invalid_values;
  end if;

  select string_agg(distinct e.branch, ', ' order by e.branch)
  into invalid_values
  from public.queue_events e
  left join public.branches br on br.slug = e.branch
  where e.branch is not null and br.slug is null;
  if invalid_values is not null then
    raise exception 'Unknown branch value(s) in public.queue_events.branch: %', invalid_values;
  end if;

  select string_agg(distinct h.branch, ', ' order by h.branch)
  into invalid_values
  from public.pos_handoffs h
  left join public.branches br on br.slug = h.branch
  where h.branch is not null and br.slug is null;
  if invalid_values is not null then
    raise exception 'Unknown branch value(s) in public.pos_handoffs.branch: %', invalid_values;
  end if;

  select string_agg(distinct v.first_branch, ', ' order by v.first_branch)
  into invalid_values
  from public.vehicles v
  left join public.branches br on br.slug = v.first_branch
  where v.first_branch is not null and br.slug is null;
  if invalid_values is not null then
    raise exception 'Unknown branch value(s) in public.vehicles.first_branch: %', invalid_values;
  end if;

  select string_agg(distinct v.last_branch, ', ' order by v.last_branch)
  into invalid_values
  from public.vehicles v
  left join public.branches br on br.slug = v.last_branch
  where v.last_branch is not null and br.slug is null;
  if invalid_values is not null then
    raise exception 'Unknown branch value(s) in public.vehicles.last_branch: %', invalid_values;
  end if;
end
$preflight$;

alter table public.queue_assignments
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text;

update public.queue_assignments
set status = case status
  when 'assigned' then 'active'
  when 'in_progress' then 'active'
  when 'completed' then 'released'
  else status
end
where status in ('assigned', 'in_progress', 'completed');

with ranked_active as (
  select id,
    row_number() over (
      partition by booking_id, staff_id
      order by coalesce(started_at, created_at, 'infinity'::timestamptz),
        coalesce(created_at, 'infinity'::timestamptz),
        id
    ) as active_rank
  from public.queue_assignments
  where status = 'active'
)
update public.queue_assignments qa
set status = 'cancelled',
    cancelled_at = coalesce(qa.cancelled_at, clock_timestamp()),
    cancellation_reason = coalesce(
      qa.cancellation_reason,
      'Duplicate active assignment cleaned during migration'
    )
from ranked_active ranked
where ranked.id = qa.id
  and ranked.active_rank > 1;

alter table public.queue_assignments
  alter column status set default 'active',
  alter column status set not null;

do $assignment_constraints$
declare
  constraint_record record;
begin
  for constraint_record in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.queue_assignments'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format(
      'alter table public.queue_assignments drop constraint %I',
      constraint_record.conname
    );
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.queue_assignments'::regclass
      and conname = 'queue_assignments_status_check'
  ) then
    alter table public.queue_assignments
      add constraint queue_assignments_status_check
      check (status in ('active', 'released', 'cancelled')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.queue_assignments'::regclass
      and conname = 'queue_assignments_released_after_started_check'
  ) then
    alter table public.queue_assignments
      add constraint queue_assignments_released_after_started_check
      check (released_at is null or started_at is null or released_at >= started_at) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.queue_assignments'::regclass
      and conname = 'queue_assignments_completed_after_started_check'
  ) then
    alter table public.queue_assignments
      add constraint queue_assignments_completed_after_started_check
      check (completed_at is null or started_at is null or completed_at >= started_at) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.queue_assignments'::regclass
      and conname = 'queue_assignments_cancelled_after_created_check'
  ) then
    alter table public.queue_assignments
      add constraint queue_assignments_cancelled_after_created_check
      check (cancelled_at is null or created_at is null or cancelled_at >= created_at) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.queue_assignments'::regclass
      and conname = 'queue_assignments_cancelled_by_fkey'
  ) then
    alter table public.queue_assignments
      add constraint queue_assignments_cancelled_by_fkey
      foreign key (cancelled_by) references auth.users(id) on delete set null not valid;
  end if;
end
$assignment_constraints$;

alter table public.queue_assignments
  validate constraint queue_assignments_status_check;
alter table public.queue_assignments
  validate constraint queue_assignments_released_after_started_check;
alter table public.queue_assignments
  validate constraint queue_assignments_completed_after_started_check;
alter table public.queue_assignments
  validate constraint queue_assignments_cancelled_after_created_check;
alter table public.queue_assignments
  validate constraint queue_assignments_cancelled_by_fkey;

create unique index if not exists queue_assignments_one_active_staff_booking_idx
  on public.queue_assignments (booking_id, staff_id)
  where status = 'active';

create index if not exists idx_queue_assignments_staff
  on public.queue_assignments (staff_id);
create index if not exists idx_queue_assignments_status
  on public.queue_assignments (status);
create index if not exists idx_queue_assignments_started_at
  on public.queue_assignments (started_at);
create index if not exists idx_queue_assignments_released_at
  on public.queue_assignments (released_at);
create index if not exists idx_queue_assignments_booking_staff
  on public.queue_assignments (booking_id, staff_id);

alter table public.bookings
  add column if not exists sent_to_payment_at timestamptz;

alter table public.branches
  add column if not exists code text,
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

update public.branches
set code = case slug
  when 'bacoor' then 'BAC'
  when 'batangas' then 'BTG'
  else code
end
where code is null;

update public.branches
set is_active = true
where is_active is null;

do $branch_code_preflight$
declare
  invalid_slugs text;
begin
  select string_agg(slug, ', ' order by slug)
  into invalid_slugs
  from public.branches
  where code is null;

  if invalid_slugs is not null then
    raise exception 'Existing branch rows require explicit codes before migration: %', invalid_slugs;
  end if;
end
$branch_code_preflight$;

alter table public.branches
  alter column code set not null,
  alter column is_active set not null;

do $branch_constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.branches'::regclass
      and conname = 'branches_code_format_check'
  ) then
    alter table public.branches
      add constraint branches_code_format_check
      check (code ~ '^[A-Z]{2,5}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.branches'::regclass
      and conname = 'branches_slug_format_check'
  ) then
    alter table public.branches
      add constraint branches_slug_format_check
      check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.branches'::regclass
      and conname = 'branches_archive_state_check'
  ) then
    alter table public.branches
      add constraint branches_archive_state_check
      check (
        (not is_archived and archived_at is null)
        or (is_archived and not is_active and archived_at is not null)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.branches'::regclass
      and conname = 'branches_created_by_fkey'
  ) then
    alter table public.branches
      add constraint branches_created_by_fkey
      foreign key (created_by) references auth.users(id) on delete set null not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.branches'::regclass
      and conname = 'branches_updated_by_fkey'
  ) then
    alter table public.branches
      add constraint branches_updated_by_fkey
      foreign key (updated_by) references auth.users(id) on delete set null not valid;
  end if;
end
$branch_constraints$;

create unique index if not exists branches_code_key
  on public.branches (code);

alter table public.branches validate constraint branches_code_format_check;
alter table public.branches validate constraint branches_slug_format_check;
alter table public.branches validate constraint branches_archive_state_check;
alter table public.branches validate constraint branches_created_by_fkey;
alter table public.branches validate constraint branches_updated_by_fkey;

do $remove_fixed_branch_check$
declare
  constraint_record record;
begin
  for constraint_record in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.bookings'::regclass
      and c.contype = 'c'
      and (
        pg_get_constraintdef(c.oid) ilike '%bacoor%'
        or pg_get_constraintdef(c.oid) ilike '%batangas%'
      )
  loop
    execute format(
      'alter table public.bookings drop constraint %I',
      constraint_record.conname
    );
  end loop;
end
$remove_fixed_branch_check$;

do $branch_foreign_keys$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_branch_fkey'
  ) then
    alter table public.bookings
      add constraint bookings_branch_fkey foreign key (branch)
      references public.branches(slug) on update cascade on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.queue_events'::regclass
      and conname = 'queue_events_branch_fkey'
  ) then
    alter table public.queue_events
      add constraint queue_events_branch_fkey foreign key (branch)
      references public.branches(slug) on update cascade on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pos_handoffs'::regclass
      and conname = 'pos_handoffs_branch_fkey'
  ) then
    alter table public.pos_handoffs
      add constraint pos_handoffs_branch_fkey foreign key (branch)
      references public.branches(slug) on update cascade on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vehicles'::regclass
      and conname = 'vehicles_first_branch_fkey'
  ) then
    alter table public.vehicles
      add constraint vehicles_first_branch_fkey foreign key (first_branch)
      references public.branches(slug) on update cascade on delete restrict not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vehicles'::regclass
      and conname = 'vehicles_last_branch_fkey'
  ) then
    alter table public.vehicles
      add constraint vehicles_last_branch_fkey foreign key (last_branch)
      references public.branches(slug) on update cascade on delete restrict not valid;
  end if;
end
$branch_foreign_keys$;

alter table public.bookings validate constraint bookings_branch_fkey;
alter table public.queue_events validate constraint queue_events_branch_fkey;
alter table public.pos_handoffs validate constraint pos_handoffs_branch_fkey;
alter table public.vehicles validate constraint vehicles_first_branch_fkey;
alter table public.vehicles validate constraint vehicles_last_branch_fkey;

insert into public.staff_profiles (
  id, full_name, role, branch_slug, phone, is_active, is_archived
)
select c.id, c.full_name, c.role, null, c.phone, true, false
from public.customers c
join auth.users u on u.id = c.id
where c.role::text in ('admin', 'BossMich')
  and not coalesce(c.is_archived, false)
on conflict (id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    is_active = true,
    is_archived = false,
    updated_at = now();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select sp.role::text
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and coalesce(sp.is_active, false)
        and not coalesce(sp.is_archived, false)
      limit 1
    ),
    'anon'
  );
$$;

create or replace function public.current_user_branch()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select sp.branch_slug
  from public.staff_profiles sp
  where sp.id = (select auth.uid())
    and coalesce(sp.is_active, false)
    and not coalesce(sp.is_archived, false)
  limit 1;
$$;

create or replace function public.current_user_branch_slug()
returns text
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.current_user_branch();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.current_user_role() in ('admin', 'BossMich');
$$;

create or replace function public.is_team_lead()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.current_user_role() = 'team_lead';
$$;

create or replace function public.can_manage_branch(target_branch text)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select case
    when public.is_admin() then true
    when public.is_team_lead() then public.current_user_branch() = target_branch
    else false
  end;
$$;

create or replace function public.can_view_queue_branch(input_branch text)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.can_manage_branch(input_branch);
$$;

create or replace function public.can_edit_queue_branch(input_branch text)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.can_manage_branch(input_branch);
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_user_branch() from public, anon;
revoke all on function public.current_user_branch_slug() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_team_lead() from public, anon;
revoke all on function public.can_manage_branch(text) from public, anon;
revoke all on function public.can_view_queue_branch(text) from public, anon;
revoke all on function public.can_edit_queue_branch(text) from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_branch() to authenticated;
grant execute on function public.current_user_branch_slug() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_team_lead() to authenticated;
grant execute on function public.can_manage_branch(text) to authenticated;
grant execute on function public.can_view_queue_branch(text) to authenticated;
grant execute on function public.can_edit_queue_branch(text) to authenticated;

create or replace function public.handle_queue_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  transition_time timestamptz := statement_timestamp();
begin
  if new.status::text = 'in_progress'
     and old.status is distinct from new.status then
    new.in_progress_at := coalesce(new.in_progress_at, old.in_progress_at, transition_time);
    new.actual_start := coalesce(new.actual_start, old.actual_start, new.in_progress_at, transition_time);
  end if;

  if new.status::text = 'for_payment'
     and old.status is distinct from new.status then
    new.for_payment_at := coalesce(new.for_payment_at, old.for_payment_at, transition_time);
    new.actual_end := coalesce(new.actual_end, old.actual_end, transition_time);
  end if;

  if new.status::text = 'completed'
     and old.status is distinct from new.status then
    new.completed_at := coalesce(new.completed_at, old.completed_at, transition_time);
    new.actual_end := coalesce(new.actual_end, old.actual_end, transition_time);
  end if;

  return new;
end;
$$;

create or replace function public.start_assignments_on_booking_progress()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.status::text = 'in_progress'
     and old.status is distinct from new.status then
    update public.queue_assignments qa
    set started_at = coalesce(qa.started_at, new.in_progress_at, statement_timestamp())
    where qa.booking_id = new.id
      and qa.status = 'active'
      and qa.started_at is null;
  end if;
  return new;
end;
$$;

create or replace function public.start_late_queue_assignment()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  booking_status text;
begin
  select b.status::text
  into booking_status
  from public.bookings b
  where b.id = new.booking_id;

  if booking_status = 'in_progress' and new.status = 'active' then
    new.started_at := coalesce(new.started_at, clock_timestamp());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_start_assignments_on_booking_progress on public.bookings;
create trigger trg_start_assignments_on_booking_progress
after update of status on public.bookings
for each row execute function public.start_assignments_on_booking_progress();

drop trigger if exists trg_start_late_queue_assignment on public.queue_assignments;
create trigger trg_start_late_queue_assignment
before insert on public.queue_assignments
for each row execute function public.start_late_queue_assignment();

revoke all on function public.handle_queue_timestamps() from public, anon, authenticated;
revoke all on function public.start_assignments_on_booking_progress() from public, anon, authenticated;
revoke all on function public.start_late_queue_assignment() from public, anon, authenticated;

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
  on conflict (booking_id, staff_id) where status = 'active' do nothing;

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

drop trigger if exists trg_create_pos_handoff on public.bookings;
drop function if exists public.create_pos_handoff();

create or replace function public.send_queue_ticket_to_payment(input_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  caller_customer_id uuid;
  target_booking public.bookings%rowtype;
  target_handoff public.pos_handoffs%rowtype;
  target_amount integer;
  target_transaction_id uuid;
  release_time timestamptz := clock_timestamp();
  released_count integer := 0;
  handoff_created boolean := false;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'team_lead') then
    raise exception using errcode = '42501', message = 'Only BossMich, admin, or team lead may send a booking to payment';
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
    raise exception using errcode = '42501', message = 'Team leads may only send bookings from their own branch to payment';
  end if;

  if target_booking.status::text not in ('final_checking', 'for_payment', 'completed') then
    raise exception using errcode = '23514', message = 'Booking must be final checking, for payment, or completed';
  end if;

  if target_booking.customer_id is null or target_booking.service_id is null then
    raise exception using errcode = '23502', message = 'Booking requires a customer and service before payment handoff';
  end if;

  select coalesce(target_booking.price_minor, target_booking.final_price_minor, s.price_minor, 0)
  into target_amount
  from public.services s
  where s.id = target_booking.service_id;

  if coalesce(target_amount, 0) <= 0 then
    raise exception using errcode = '23514', message = 'Booking requires a positive payment amount';
  end if;

  select c.id
  into caller_customer_id
  from public.customers c
  where c.id = caller_id
    and not coalesce(c.is_archived, false)
  limit 1;

  select ph.*
  into target_handoff
  from public.pos_handoffs ph
  where ph.booking_id = target_booking.id
  for update;

  if not found then
    insert into public.pos_handoffs (
      booking_id, customer_id, vehicle_id, branch, amount_minor,
      currency, status, handed_off_by, handed_off_at
    )
    values (
      target_booking.id, target_booking.customer_id, target_booking.vehicle_id,
      target_booking.branch, target_amount, 'PHP', 'pending', caller_id,
      release_time
    )
    returning * into target_handoff;
    handoff_created := true;
  else
    update public.pos_handoffs ph
    set customer_id = target_booking.customer_id,
        vehicle_id = target_booking.vehicle_id,
        branch = target_booking.branch,
        amount_minor = target_amount,
        currency = coalesce(ph.currency, 'PHP'),
        handed_off_by = coalesce(ph.handed_off_by, caller_id),
        updated_at = release_time
    where ph.id = target_handoff.id
    returning * into target_handoff;
  end if;

  target_transaction_id := target_handoff.transaction_id;
  if target_transaction_id is null then
    select t.id
    into target_transaction_id
    from public.transactions t
    where t.booking_id = target_booking.id
      and t.type = 'sale'
      and not coalesce(t.is_archived, false)
    order by t.created_at desc
    limit 1
    for update;
  end if;

  if target_transaction_id is null then
    insert into public.transactions (
      booking_id, customer_id, vehicle_id, pos_handoff_id, recorded_by,
      type, amount_minor, currency, description, occurred_at, status
    )
    values (
      target_booking.id, target_booking.customer_id, target_booking.vehicle_id,
      target_handoff.id, caller_customer_id, 'sale', target_amount, 'PHP',
      'Queue ticket pending payment', release_time, 'pending_payment'
    )
    returning id into target_transaction_id;
  else
    update public.transactions t
    set customer_id = target_booking.customer_id,
        vehicle_id = target_booking.vehicle_id,
        pos_handoff_id = target_handoff.id,
        recorded_by = coalesce(t.recorded_by, caller_customer_id),
        amount_minor = target_amount,
        currency = coalesce(t.currency, 'PHP'),
        description = coalesce(t.description, 'Queue ticket pending payment'),
        status = case when t.status = 'completed' then t.status else 'pending_payment' end,
        updated_at = release_time
    where t.id = target_transaction_id;
  end if;

  update public.pos_handoffs ph
  set transaction_id = target_transaction_id,
      updated_at = release_time
  where ph.id = target_handoff.id;

  if target_booking.status::text = 'final_checking' then
    update public.bookings b
    set status = 'for_payment',
        for_payment_at = coalesce(b.for_payment_at, release_time),
        sent_to_payment_at = coalesce(b.sent_to_payment_at, release_time),
        sent_to_payment_by = coalesce(b.sent_to_payment_by, caller_customer_id),
        price_minor = coalesce(b.price_minor, target_amount),
        final_price_minor = coalesce(b.final_price_minor, target_amount),
        actual_end = coalesce(b.actual_end, release_time),
        updated_at = release_time
    where b.id = target_booking.id;
  end if;

  update public.queue_assignments qa
  set status = 'released',
      released_at = coalesce(qa.released_at, release_time),
      completed_at = coalesce(qa.completed_at, qa.released_at, release_time)
  where qa.booking_id = target_booking.id
    and qa.status = 'active';

  get diagnostics released_count = row_count;

  return jsonb_build_object(
    'booking_id', target_booking.id,
    'handoff_id', target_handoff.id,
    'released_assignment_count', released_count,
    'handoff_created', handoff_created
  );
end;
$$;

revoke all on function public.send_queue_ticket_to_payment(uuid) from public, anon;
grant execute on function public.send_queue_ticket_to_payment(uuid) to authenticated;

create or replace function public.complete_payment(
  input_booking_id uuid,
  input_payment_method text,
  input_reference_number text default null,
  input_payment_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  target_booking public.bookings%rowtype;
  target_handoff public.pos_handoffs%rowtype;
  target_transaction public.transactions%rowtype;
  completion_time timestamptz := clock_timestamp();
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'cashier') then
    raise exception using errcode = '42501', message = 'Only BossMich, admin, or cashier may complete payment';
  end if;

  select b.*
  into target_booking
  from public.bookings b
  where b.id = input_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  if caller_role = 'cashier'
     and public.current_user_branch() is distinct from target_booking.branch then
    raise exception using errcode = '42501', message = 'Cashiers may only complete payments in their own branch';
  end if;

  select ph.*
  into target_handoff
  from public.pos_handoffs ph
  where ph.booking_id = input_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Payment handoff not found';
  end if;

  select t.*
  into target_transaction
  from public.transactions t
  where t.id = target_handoff.transaction_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Payment transaction not found';
  end if;

  if target_handoff.status = 'completed' and target_transaction.status = 'completed' then
    return jsonb_build_object(
      'booking_id', input_booking_id,
      'transaction_id', target_transaction.id,
      'payment_completed', false,
      'reused', true
    );
  end if;

  update public.transactions t
  set status = 'completed',
      payment_method = input_payment_method,
      reference_number = input_reference_number,
      payment_notes = input_payment_notes,
      occurred_at = completion_time,
      updated_at = completion_time
  where t.id = target_transaction.id;

  update public.pos_handoffs ph
  set status = 'completed',
      completed_at = coalesce(ph.completed_at, completion_time),
      updated_at = completion_time
  where ph.id = target_handoff.id;

  update public.bookings b
  set status = 'completed',
      completed_at = coalesce(b.completed_at, completion_time),
      actual_end = coalesce(b.actual_end, completion_time),
      updated_at = completion_time
  where b.id = input_booking_id;

  update public.vehicles v
  set last_visit_at = completion_time,
      last_branch = target_booking.branch,
      total_visits = coalesce(v.total_visits, 0) + 1,
      updated_at = completion_time
  where v.id = target_booking.vehicle_id;

  update public.customers c
  set loyalty_points = coalesce(c.loyalty_points, 0)
        + floor(coalesce(target_handoff.amount_minor, 0) / 10000)::integer,
      updated_at = completion_time
  where c.id = target_booking.customer_id;

  return jsonb_build_object(
    'booking_id', input_booking_id,
    'transaction_id', target_transaction.id,
    'payment_completed', true,
    'reused', false
  );
end;
$$;

revoke all on function public.complete_payment(uuid, text, text, text) from public, anon;
grant execute on function public.complete_payment(uuid, text, text, text) to authenticated;

create or replace function public.get_crew_kpi(
  input_start_date date,
  input_end_date date,
  input_branch_slug text default null
)
returns table (
  staff_id uuid,
  staff_name text,
  branch_slug text,
  branch_name text,
  branch_code text,
  cars_handled bigint,
  completed_deployed_seconds bigint,
  active_jobs bigint,
  active_deployed_seconds bigint,
  average_completed_seconds numeric,
  cancelled_assignments bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  effective_branch text := input_branch_slug;
  range_start timestamptz;
  range_end timestamptz;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if input_start_date is null or input_end_date is null or input_end_date < input_start_date then
    raise exception using errcode = '22007', message = 'A valid inclusive date range is required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'team_lead') then
    raise exception using errcode = '42501', message = 'Crew KPI access is restricted to BossMich, admin, or team lead';
  end if;

  if caller_role = 'team_lead' then
    if effective_branch is not null
       and effective_branch is distinct from public.current_user_branch() then
      raise exception using errcode = '42501', message = 'Team leads may only view their own branch KPI';
    end if;
    effective_branch := public.current_user_branch();
  end if;

  if effective_branch is not null
     and not exists (select 1 from public.branches br where br.slug = effective_branch) then
    raise exception using errcode = 'P0002', message = 'Branch not found';
  end if;

  range_start := input_start_date::timestamp at time zone 'Asia/Manila';
  range_end := (input_end_date + 1)::timestamp at time zone 'Asia/Manila';

  return query
  with completed_sessions as (
    select qa.staff_id,
      b.branch,
      count(distinct qa.booking_id)::bigint as cars_handled,
      floor(sum(extract(epoch from (coalesce(qa.released_at, qa.completed_at) - qa.started_at))))::bigint
        as completed_seconds
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where qa.status = 'released'
      and qa.started_at is not null
      and coalesce(qa.released_at, qa.completed_at) is not null
      and coalesce(qa.released_at, qa.completed_at) >= range_start
      and coalesce(qa.released_at, qa.completed_at) < range_end
      and (effective_branch is null or b.branch = effective_branch)
    group by qa.staff_id, b.branch
  ),
  active_sessions as (
    select qa.staff_id,
      b.branch,
      count(*)::bigint as active_jobs,
      floor(sum(greatest(0, extract(epoch from (clock_timestamp() - qa.started_at)))))::bigint
        as active_seconds
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where qa.status = 'active'
      and qa.started_at is not null
      and (effective_branch is null or b.branch = effective_branch)
    group by qa.staff_id, b.branch
  ),
  cancelled_sessions as (
    select qa.staff_id,
      b.branch,
      count(*)::bigint as cancelled_count
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where qa.status = 'cancelled'
      and qa.cancelled_at >= range_start
      and qa.cancelled_at < range_end
      and (effective_branch is null or b.branch = effective_branch)
    group by qa.staff_id, b.branch
  ),
  metric_keys as (
    select c.staff_id, c.branch from completed_sessions c
    union
    select a.staff_id, a.branch from active_sessions a
    union
    select x.staff_id, x.branch from cancelled_sessions x
  )
  select k.staff_id,
    sp.full_name,
    k.branch,
    br.name,
    br.code,
    coalesce(c.cars_handled, 0),
    coalesce(c.completed_seconds, 0),
    coalesce(a.active_jobs, 0),
    coalesce(a.active_seconds, 0),
    case
      when coalesce(c.cars_handled, 0) = 0 then 0::numeric
      else c.completed_seconds::numeric / c.cars_handled::numeric
    end,
    coalesce(x.cancelled_count, 0)
  from metric_keys k
  join public.staff_profiles sp on sp.id = k.staff_id
  join public.branches br on br.slug = k.branch
  left join completed_sessions c on c.staff_id = k.staff_id and c.branch = k.branch
  left join active_sessions a on a.staff_id = k.staff_id and a.branch = k.branch
  left join cancelled_sessions x on x.staff_id = k.staff_id and x.branch = k.branch
  order by br.name, sp.full_name, sp.id;
end;
$$;

revoke all on function public.get_crew_kpi(date, date, text) from public, anon;
grant execute on function public.get_crew_kpi(date, date, text) to authenticated;

create or replace function public.get_branch_throughput(
  input_start_date date,
  input_end_date date,
  input_branch_slug text default null
)
returns table (
  branch_slug text,
  branch_name text,
  branch_code text,
  completed_vehicle_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  effective_branch text := input_branch_slug;
  range_start timestamptz;
  range_end timestamptz;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if input_start_date is null or input_end_date is null or input_end_date < input_start_date then
    raise exception using errcode = '22007', message = 'A valid inclusive date range is required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'team_lead') then
    raise exception using errcode = '42501', message = 'Branch throughput access is restricted to BossMich, admin, or team lead';
  end if;

  if caller_role = 'team_lead' then
    if effective_branch is not null
       and effective_branch is distinct from public.current_user_branch() then
      raise exception using errcode = '42501', message = 'Team leads may only view their own branch throughput';
    end if;
    effective_branch := public.current_user_branch();
  end if;

  range_start := input_start_date::timestamp at time zone 'Asia/Manila';
  range_end := (input_end_date + 1)::timestamp at time zone 'Asia/Manila';

  return query
  select br.slug,
    br.name,
    br.code,
    count(distinct b.id) filter (
      where b.status::text in ('for_payment', 'completed')
        and not coalesce(b.is_archived, false)
        and coalesce(b.for_payment_at, b.completed_at) >= range_start
        and coalesce(b.for_payment_at, b.completed_at) < range_end
    )::bigint
  from public.branches br
  left join public.bookings b on b.branch = br.slug
  where effective_branch is null or br.slug = effective_branch
  group by br.slug, br.name, br.code
  order by br.name, br.slug;
end;
$$;

revoke all on function public.get_branch_throughput(date, date, text) from public, anon;
grant execute on function public.get_branch_throughput(date, date, text) to authenticated;

create or replace function public.create_branch(
  input_name text,
  input_slug text,
  input_code text,
  input_address text
)
returns public.branches
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_slug text := lower(trim(input_slug));
  normalized_code text := upper(trim(input_code));
  created_branch public.branches%rowtype;
begin
  if caller_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only BossMich or admin may create branches';
  end if;
  if nullif(trim(input_name), '') is null then
    raise exception using errcode = '23514', message = 'Branch name is required';
  end if;
  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '23514', message = 'Branch slug must be lowercase and URL-safe';
  end if;
  if normalized_code !~ '^[A-Z]{2,5}$' then
    raise exception using errcode = '23514', message = 'Branch code must contain 2 to 5 uppercase letters';
  end if;

  insert into public.branches (
    slug, name, code, address, is_active, is_archived,
    archived_at, created_by, updated_by, created_at, updated_at
  )
  values (
    normalized_slug, trim(input_name), normalized_code, nullif(trim(input_address), ''),
    true, false, null, caller_id, caller_id, clock_timestamp(), clock_timestamp()
  )
  returning * into created_branch;

  return created_branch;
end;
$$;

create or replace function public.update_branch(
  input_branch_slug text,
  input_name text,
  input_code text,
  input_address text,
  input_is_active boolean
)
returns public.branches
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_code text := upper(trim(input_code));
  updated_branch public.branches%rowtype;
begin
  if caller_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only BossMich or admin may update branches';
  end if;
  if nullif(trim(input_name), '') is null then
    raise exception using errcode = '23514', message = 'Branch name is required';
  end if;
  if normalized_code !~ '^[A-Z]{2,5}$' then
    raise exception using errcode = '23514', message = 'Branch code must contain 2 to 5 uppercase letters';
  end if;

  update public.branches br
  set name = trim(input_name),
      code = normalized_code,
      address = nullif(trim(input_address), ''),
      is_active = coalesce(input_is_active, br.is_active),
      updated_by = caller_id,
      updated_at = clock_timestamp()
  where br.slug = lower(trim(input_branch_slug))
    and not br.is_archived
  returning * into updated_branch;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active branch not found';
  end if;
  return updated_branch;
end;
$$;

create or replace function public.archive_branch(input_branch_slug text)
returns public.branches
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  target_slug text := lower(trim(input_branch_slug));
  archived_branch public.branches%rowtype;
begin
  if caller_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only BossMich or admin may archive branches';
  end if;

  perform 1 from public.branches br where br.slug = target_slug for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Branch not found';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.branch = target_slug
      and b.status::text in ('pending', 'confirmed', 'waiting', 'in_progress', 'final_checking')
      and not coalesce(b.is_archived, false)
  ) or exists (
    select 1
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where b.branch = target_slug and qa.status = 'active'
  ) or exists (
    select 1 from public.pos_handoffs ph
    where ph.branch = target_slug and ph.status <> 'completed'
  ) then
    raise exception using errcode = '55006', message = 'Branch has active bookings, assignments, or pending payment handoffs';
  end if;

  update public.branches br
  set is_archived = true,
      is_active = false,
      archived_at = coalesce(br.archived_at, clock_timestamp()),
      updated_by = caller_id,
      updated_at = clock_timestamp()
  where br.slug = target_slug
  returning * into archived_branch;

  return archived_branch;
end;
$$;

create or replace function public.reactivate_branch(input_branch_slug text)
returns public.branches
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  reactivated_branch public.branches%rowtype;
begin
  if caller_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only BossMich or admin may reactivate branches';
  end if;

  update public.branches br
  set is_archived = false,
      is_active = true,
      archived_at = null,
      updated_by = caller_id,
      updated_at = clock_timestamp()
  where br.slug = lower(trim(input_branch_slug))
  returning * into reactivated_branch;

  if not found then
    raise exception using errcode = 'P0002', message = 'Branch not found';
  end if;
  return reactivated_branch;
end;
$$;

revoke all on function public.create_branch(text, text, text, text) from public, anon;
revoke all on function public.update_branch(text, text, text, text, boolean) from public, anon;
revoke all on function public.archive_branch(text) from public, anon;
revoke all on function public.reactivate_branch(text) from public, anon;
grant execute on function public.create_branch(text, text, text, text) to authenticated;
grant execute on function public.update_branch(text, text, text, text, boolean) to authenticated;
grant execute on function public.archive_branch(text) to authenticated;
grant execute on function public.reactivate_branch(text) to authenticated;

create or replace function public.get_my_queue_work()
returns table (
  assignment_id uuid,
  booking_id uuid,
  branch_slug text,
  queue_number integer,
  queue_date date,
  booking_status public.booking_status,
  vehicle_make text,
  vehicle_model text,
  vehicle_type text,
  service_name text,
  task_name text,
  assignment_status text,
  started_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select qa.id,
    b.id,
    b.branch,
    b.queue_number,
    b.queue_date,
    b.status,
    b.vehicle_make,
    b.vehicle_model,
    b.vehicle_type,
    s.name,
    qa.task_name,
    qa.status,
    qa.started_at
  from public.queue_assignments qa
  join public.bookings b on b.id = qa.booking_id
  join public.services s on s.id = b.service_id
  where (select auth.uid()) is not null
    and public.current_user_role() = 'staff'
    and qa.staff_id = (select auth.uid())
    and qa.status = 'active'
    and not coalesce(b.is_archived, false)
  order by b.queue_date, b.queue_number, b.id;
$$;

revoke all on function public.get_my_queue_work() from public, anon;
grant execute on function public.get_my_queue_work() to authenticated;

alter table public.branches enable row level security;
alter table public.bookings enable row level security;
alter table public.queue_assignments enable row level security;
alter table public.queue_events enable row level security;
alter table public.pos_handoffs enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_attendance enable row level security;

do $drop_targeted_policies$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'branches', 'bookings', 'queue_assignments', 'queue_events',
        'pos_handoffs', 'staff_profiles', 'staff_attendance'
      )
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$drop_targeted_policies$;

create policy "Public can read active branches"
on public.branches for select to anon
using (is_active and not is_archived);

create policy "Authenticated users can read authorized branches"
on public.branches for select to authenticated
using (
  (select public.is_admin())
  or slug = (select public.current_user_branch())
);

create policy "Public can read safe active queue rows"
on public.bookings for select to anon
using (
  status in ('waiting', 'in_progress', 'final_checking')
  and not is_archived
);

create policy "Public can submit pending bookings"
on public.bookings for insert to anon
with check (
  status = 'pending'
  and not is_archived
  and assigned_staff_id is null
  and exists (
    select 1 from public.branches br
    where br.slug = branch and br.is_active and not br.is_archived
  )
);

create policy "Queue managers can read authorized bookings"
on public.bookings for select to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_team_lead())
    and branch = (select public.current_user_branch())
  )
);

create policy "Queue managers can insert authorized bookings"
on public.bookings for insert to authenticated
with check ((select public.can_manage_branch(branch)));

create policy "Queue managers can update authorized bookings"
on public.bookings for update to authenticated
using ((select public.can_manage_branch(branch)))
with check ((select public.can_manage_branch(branch)));

create policy "Authorized users can read queue assignments"
on public.queue_assignments for select to authenticated
using (
  staff_id = (select auth.uid())
  or exists (
    select 1
    from public.bookings b
    where b.id = queue_assignments.booking_id
      and (select public.can_manage_branch(b.branch))
  )
);

create policy "Queue managers can read branch events"
on public.queue_events for select to authenticated
using ((select public.can_manage_branch(branch)));

create policy "Queue managers can insert branch events"
on public.queue_events for insert to authenticated
with check (
  (select public.can_manage_branch(branch))
  and (changed_by is null or changed_by = (select auth.uid()))
);

create policy "Authorized payment users can read handoffs"
on public.pos_handoffs for select to authenticated
using (
  (select public.is_admin())
  or (
    (select public.current_user_role()) in ('team_lead', 'cashier')
    and branch = (select public.current_user_branch())
  )
);

create policy "Authorized users can read staff profiles"
on public.staff_profiles for select to authenticated
using (
  (select public.is_admin())
  or id = (select auth.uid())
  or (
    (select public.is_team_lead())
    and branch_slug = (select public.current_user_branch())
  )
);

create policy "Admins can insert staff profiles"
on public.staff_profiles for insert to authenticated
with check ((select public.is_admin()));

create policy "Admins can update staff profiles"
on public.staff_profiles for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Authorized users can read staff attendance"
on public.staff_attendance for select to authenticated
using (
  (select public.is_admin())
  or staff_id = (select auth.uid())
  or (
    (select public.is_team_lead())
    and branch_slug = (select public.current_user_branch())
  )
);

create policy "Queue managers can insert staff attendance"
on public.staff_attendance for insert to authenticated
with check ((select public.can_manage_branch(branch_slug)));

create policy "Queue managers can update staff attendance"
on public.staff_attendance for update to authenticated
using ((select public.can_manage_branch(branch_slug)))
with check ((select public.can_manage_branch(branch_slug)));

revoke all on public.branches from anon, authenticated;
revoke all on public.bookings from anon, authenticated;
revoke all on public.queue_assignments from anon, authenticated;
revoke all on public.queue_events from anon, authenticated;
revoke all on public.pos_handoffs from anon, authenticated;
revoke all on public.staff_profiles from anon, authenticated;
revoke all on public.staff_attendance from anon, authenticated;

grant select on public.branches to anon, authenticated;
grant insert on public.bookings to anon;
grant select (branch, queue_number, status, is_archived) on public.bookings to anon;

grant select, insert, update on public.bookings to authenticated;
grant select on public.queue_assignments to authenticated;
grant select, insert on public.queue_events to authenticated;
grant select on public.pos_handoffs to authenticated;
grant select, insert, update on public.staff_profiles to authenticated;
grant select, insert, update on public.staff_attendance to authenticated;

alter view public.public_queue_counts set (security_invoker = true);
alter view public.public_queue_numbers set (security_invoker = true);

revoke all on public.public_queue_counts from public, anon, authenticated;
revoke all on public.public_queue_numbers from public, anon, authenticated;
grant select on public.public_queue_counts to anon, authenticated;
grant select on public.public_queue_numbers to anon, authenticated;

revoke all on public.crew_kpi_summary from public, anon, authenticated;
revoke all on public.active_customer_queue from anon;
revoke all on public.operations_queue_board from anon;
revoke all on public.customer_vehicle_masterlist from anon;
revoke all on public.pos_ready_tickets from anon;
revoke all on public.available_staff_view from anon;
revoke all on public.busy_staff_view from anon;

grant select on public.operations_queue_board to authenticated;
grant select on public.customer_vehicle_masterlist to authenticated;
grant select on public.pos_ready_tickets to authenticated;
grant select on public.available_staff_view to authenticated;
grant select on public.busy_staff_view to authenticated;

create index if not exists idx_bookings_status
  on public.bookings (status);
create index if not exists idx_bookings_queue_date
  on public.bookings (queue_date);
create index if not exists idx_staff_profiles_branch_slug
  on public.staff_profiles (branch_slug);
create index if not exists idx_staff_profiles_role
  on public.staff_profiles (role);
create index if not exists idx_queue_events_branch_created_at
  on public.queue_events (branch, created_at);
create index if not exists idx_pos_handoffs_branch_handed_off_at
  on public.pos_handoffs (branch, handed_off_at);

do $harden_related_functions$
declare
  function_record record;
begin
  for function_record in
    select p.oid::regprocedure as function_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'normalize_plate_number', 'assign_daily_queue_number',
        'link_booking_to_masterlist', 'log_queue_status_change',
        'create_completion_sms_event', 'archive_instead_of_delete'
      )
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public',
      function_record.function_signature
    );
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      function_record.function_signature
    );
  end loop;
end
$harden_related_functions$;

do $harden_legacy_helpers$
declare
  function_record record;
begin
  for function_record in
    select p.oid::regprocedure as function_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in ('is_staff', 'is_queue_editor', 'is_queue_viewer')
  loop
    execute format(
      'revoke all on function %s from public, anon',
      function_record.function_signature
    );
    execute format(
      'grant execute on function %s to authenticated',
      function_record.function_signature
    );
  end loop;
end
$harden_legacy_helpers$;

notify pgrst, 'reload schema';

commit;
