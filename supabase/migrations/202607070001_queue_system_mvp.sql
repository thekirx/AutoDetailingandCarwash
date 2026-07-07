-- Hakum Auto Care Queue System MVP hardening and workflow helpers.

begin;

alter table public.queue_assignments
add column if not exists released_at timestamptz,
add column if not exists task_notes text;

update public.queue_assignments
set status = case
  when status in ('assigned', 'in_progress') then 'active'
  when status = 'completed' then 'released'
  when status = 'cancelled' then 'cancelled'
  when status = 'released' then 'released'
  else 'active'
end
where status is distinct from case
  when status in ('assigned', 'in_progress') then 'active'
  when status = 'completed' then 'released'
  when status = 'cancelled' then 'cancelled'
  when status = 'released' then 'released'
  else 'active'
end;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sp.role::text
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and coalesce(sp.is_active, true) = true
      limit 1
    ),
    (
      select c.role::text
      from public.customers c
      where c.id = (select auth.uid())
        and coalesce(c.is_archived, false) = false
      limit 1
    ),
    'anon'
  );
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'team_lead', 'staff');
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;

create or replace view public.public_queue_counts as
select
  b.branch,
  count(*) filter (where b.status = 'waiting')::integer as waiting_count,
  count(*) filter (where b.status = 'in_progress')::integer as in_progress_count,
  count(*) filter (where b.status = 'final_checking')::integer as final_checking_count,
  count(*)::integer as total_active_count
from public.bookings b
where b.status in ('waiting', 'in_progress', 'final_checking')
  and coalesce(b.is_archived, false) = false
group by b.branch;

create or replace view public.public_queue_numbers as
select
  b.branch,
  b.queue_number,
  b.status
from public.bookings b
where b.status in ('waiting', 'in_progress', 'final_checking')
  and coalesce(b.is_archived, false) = false;

create or replace view public.busy_staff_view
with (security_invoker = true)
as
select distinct
  sp.id as staff_id,
  sp.full_name,
  sp.role,
  sp.branch_slug,
  qa.booking_id,
  b.queue_number,
  b.status as booking_status,
  qa.status as assignment_status,
  qa.created_at as assigned_at
from public.staff_profiles sp
join public.queue_assignments qa on qa.staff_id = sp.id
join public.bookings b on b.id = qa.booking_id
where sp.role = 'staff'
  and coalesce(sp.is_active, true) = true
  and qa.status = 'active'
  and b.status in ('waiting', 'in_progress', 'final_checking')
  and coalesce(b.is_archived, false) = false;

create or replace view public.available_staff_view
with (security_invoker = true)
as
select
  sp.id as staff_id,
  sp.full_name,
  sp.role,
  sp.branch_slug,
  sp.phone
from public.staff_profiles sp
where sp.role = 'staff'
  and coalesce(sp.is_active, true) = true
  and not exists (
    select 1
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where qa.staff_id = sp.id
      and qa.status = 'active'
      and b.status in ('waiting', 'in_progress', 'final_checking')
      and coalesce(b.is_archived, false) = false
  );

create or replace view public.crew_kpi_summary
with (security_invoker = true)
as
select
  qa.staff_id,
  sp.full_name as staff_name,
  sp.branch_slug as branch,
  count(*) as total_assigned,
  count(*) filter (where qa.status = 'released') as total_completed,
  avg(extract(epoch from (coalesce(qa.released_at, qa.completed_at) - qa.started_at)) / 60)
    filter (where qa.started_at is not null and coalesce(qa.released_at, qa.completed_at) is not null) as average_service_minutes,
  count(*) filter (where qa.status = 'active') as active_jobs,
  count(*) filter (where qa.status = 'released' and coalesce(qa.released_at, qa.completed_at)::date = current_date) as completed_today
from public.queue_assignments qa
left join public.staff_profiles sp on sp.id = qa.staff_id
group by qa.staff_id, sp.full_name, sp.branch_slug;

alter view public.active_customer_queue set (security_invoker = true);
alter view public.operations_queue_board set (security_invoker = true);
alter view public.customer_vehicle_masterlist set (security_invoker = true);
alter view public.pos_ready_tickets set (security_invoker = true);
alter view public.crew_kpi_summary set (security_invoker = true);

create or replace function public.send_queue_ticket_to_payment(input_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_booking public.bookings%rowtype;
  target_amount integer;
  target_handoff_id uuid;
  released_count integer;
begin
  caller_role := public.current_user_role();

  if caller_role not in ('admin', 'team_lead') then
    raise exception 'Access denied. Only admin or team lead can send tickets to payment.';
  end if;

  select *
  into target_booking
  from public.bookings
  where id = input_booking_id
    and coalesce(is_archived, false) = false
  limit 1;

  if not found then
    raise exception 'Booking not found';
  end if;

  select coalesce(target_booking.final_price_minor, s.price_minor, 0)
  into target_amount
  from public.services s
  where s.id = target_booking.service_id;

  insert into public.pos_handoffs (
    booking_id,
    customer_id,
    vehicle_id,
    branch,
    amount_minor,
    currency,
    status,
    handed_off_by,
    handed_off_at
  )
  values (
    target_booking.id,
    target_booking.customer_id,
    target_booking.vehicle_id,
    target_booking.branch,
    coalesce(target_amount, 0),
    'PHP',
    'pending',
    (select auth.uid()),
    now()
  )
  on conflict (booking_id) do update
  set amount_minor = excluded.amount_minor,
      status = 'pending',
      handed_off_by = excluded.handed_off_by,
      handed_off_at = excluded.handed_off_at,
      completed_at = null,
      updated_at = now()
  returning id into target_handoff_id;

  update public.bookings
  set status = 'for_payment',
      updated_at = now()
  where id = target_booking.id;

  update public.queue_assignments
  set status = 'released',
      released_at = coalesce(released_at, now()),
      completed_at = coalesce(completed_at, now())
  where booking_id = target_booking.id
    and status = 'active';

  get diagnostics released_count = row_count;

  insert into public.queue_events (
    booking_id,
    branch,
    old_status,
    new_status,
    changed_by,
    notes,
    created_at
  )
  values (
    target_booking.id,
    target_booking.branch,
    target_booking.status::text,
    'for_payment',
    (select auth.uid()),
    'Sent to payment; released ' || released_count || ' active staff assignment(s).',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'booking_id', target_booking.id,
    'pos_handoff_id', target_handoff_id,
    'released_assignments', released_count
  );
end;
$$;

revoke all on function public.send_queue_ticket_to_payment(uuid) from public;
grant execute on function public.send_queue_ticket_to_payment(uuid) to authenticated;

drop policy if exists "Staff can select bookings" on public.bookings;
drop policy if exists "Staff can insert bookings" on public.bookings;
drop policy if exists "Staff can update bookings" on public.bookings;

create policy "Queue managers can select bookings"
on public.bookings for select to authenticated
using (
  public.current_user_role() in ('admin', 'team_lead')
  or exists (
    select 1
    from public.queue_assignments qa
    where qa.booking_id = bookings.id
      and qa.staff_id = (select auth.uid())
  )
);

create policy "Queue managers can insert bookings"
on public.bookings for insert to authenticated
with check (public.current_user_role() in ('admin', 'team_lead'));

create policy "Queue managers can update bookings"
on public.bookings for update to authenticated
using (public.current_user_role() in ('admin', 'team_lead'))
with check (public.current_user_role() in ('admin', 'team_lead'));

drop policy if exists "Staff can select profiles" on public.customers;
drop policy if exists "Staff can insert profiles" on public.customers;
drop policy if exists "Staff can update profiles" on public.customers;
drop policy if exists "Staff can select customers" on public.customers;
drop policy if exists "Staff can insert customers" on public.customers;
drop policy if exists "Staff can update customers" on public.customers;

create policy "Queue managers can select customers"
on public.customers for select to authenticated
using (public.current_user_role() in ('admin', 'team_lead'));

create policy "Queue managers can insert customers"
on public.customers for insert to authenticated
with check (public.current_user_role() in ('admin', 'team_lead'));

create policy "Queue managers can update customers"
on public.customers for update to authenticated
using (public.current_user_role() in ('admin', 'team_lead'))
with check (public.current_user_role() in ('admin', 'team_lead'));

revoke all on public.active_customer_queue from anon;
revoke all on public.operations_queue_board from anon;
revoke all on public.customer_vehicle_masterlist from anon;
revoke all on public.pos_ready_tickets from anon;
revoke all on public.crew_kpi_summary from anon;
revoke all on public.public_queue_counts from public;
revoke all on public.public_queue_numbers from public;
revoke all on public.public_queue_counts from anon, authenticated;
revoke all on public.public_queue_numbers from anon, authenticated;
revoke all on public.available_staff_view from public;
revoke all on public.busy_staff_view from public;
revoke all on public.available_staff_view from anon, authenticated;
revoke all on public.busy_staff_view from anon, authenticated;

grant select on public.branches to anon, authenticated;
grant select on public.public_queue_counts to anon, authenticated;
grant select on public.public_queue_numbers to anon, authenticated;
grant select on public.operations_queue_board to authenticated;
grant select on public.customer_vehicle_masterlist to authenticated;
grant select on public.crew_kpi_summary to authenticated;
grant select on public.available_staff_view to authenticated;
grant select on public.busy_staff_view to authenticated;

commit;
