-- BossMich queue RBAC, peso-safe payment handoff, and pending-payment readiness.

begin;

alter type public.profile_role add value if not exists 'BossMich';

alter table public.bookings
add column if not exists final_checking_at timestamptz,
add column if not exists sent_to_payment_at timestamptz;

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

create or replace function public.current_user_branch_slug()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select sp.branch_slug
  from public.staff_profiles sp
  where sp.id = (select auth.uid())
    and coalesce(sp.is_active, true) = true
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'BossMich');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'team_lead', 'BossMich', 'staff');
$$;

create or replace function public.is_queue_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('team_lead', 'BossMich');
$$;

create or replace function public.is_queue_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'team_lead', 'BossMich');
$$;

create or replace function public.can_view_queue_branch(input_branch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_user_role() in ('admin', 'BossMich') then true
    when public.current_user_role() = 'team_lead' then public.current_user_branch_slug() = input_branch
    else false
  end;
$$;

create or replace function public.can_edit_queue_branch(input_branch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_user_role() = 'BossMich' then true
    when public.current_user_role() = 'team_lead' then public.current_user_branch_slug() = input_branch
    else false
  end;
$$;

revoke all on function public.current_user_branch_slug() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_queue_editor() from public;
revoke all on function public.is_queue_viewer() from public;
revoke all on function public.can_view_queue_branch(text) from public;
revoke all on function public.can_edit_queue_branch(text) from public;
grant execute on function public.current_user_branch_slug() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_queue_editor() to authenticated;
grant execute on function public.is_queue_viewer() to authenticated;
grant execute on function public.can_view_queue_branch(text) to authenticated;
grant execute on function public.can_edit_queue_branch(text) to authenticated;

drop policy if exists "Admin has full access to bookings" on public.bookings;
drop policy if exists "Queue managers can select bookings" on public.bookings;
drop policy if exists "Queue managers can insert bookings" on public.bookings;
drop policy if exists "Queue managers can update bookings" on public.bookings;

create policy "Queue viewers can select bookings"
on public.bookings for select to authenticated
using (
  public.can_view_queue_branch(branch)
  or exists (
    select 1
    from public.queue_assignments qa
    where qa.booking_id = bookings.id
      and qa.staff_id = (select auth.uid())
  )
);

create policy "Queue editors can insert bookings"
on public.bookings for insert to authenticated
with check (public.can_edit_queue_branch(branch));

create policy "Queue editors can update bookings"
on public.bookings for update to authenticated
using (public.can_edit_queue_branch(branch))
with check (public.can_edit_queue_branch(branch));

drop policy if exists "Allow operations read queue assignments" on public.queue_assignments;
drop policy if exists "Allow tl manage queue assignments" on public.queue_assignments;

create policy "Queue viewers can select queue assignments"
on public.queue_assignments for select to authenticated
using (
  staff_id = (select auth.uid())
  or exists (
    select 1
    from public.bookings b
    where b.id = queue_assignments.booking_id
      and public.can_view_queue_branch(b.branch)
  )
);

create policy "Queue editors can manage queue assignments"
on public.queue_assignments for all to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = queue_assignments.booking_id
      and public.can_edit_queue_branch(b.branch)
  )
)
with check (
  exists (
    select 1
    from public.bookings b
    where b.id = queue_assignments.booking_id
      and public.can_edit_queue_branch(b.branch)
  )
);

drop policy if exists "Allow admin manage staff profiles" on public.staff_profiles;

create policy "Queue editors can manage branch staff profiles"
on public.staff_profiles for all to authenticated
using (
  public.current_user_role() = 'BossMich'
  or (
    public.current_user_role() = 'team_lead'
    and branch_slug = public.current_user_branch_slug()
  )
)
with check (
  public.current_user_role() = 'BossMich'
  or (
    public.current_user_role() = 'team_lead'
    and branch_slug = public.current_user_branch_slug()
    and role = 'staff'
  )
);

drop policy if exists "Queue managers can select customers" on public.customers;
drop policy if exists "Queue managers can insert customers" on public.customers;
drop policy if exists "Queue managers can update customers" on public.customers;

create policy "Queue viewers can select customers"
on public.customers for select to authenticated
using (public.is_queue_viewer());

create policy "Queue editors can insert queue customers"
on public.customers for insert to authenticated
with check (public.is_queue_editor() and role = 'customer');

create policy "Queue editors can update queue customers"
on public.customers for update to authenticated
using (public.is_queue_editor())
with check (public.is_queue_editor());

create or replace function public.send_queue_ticket_to_payment(input_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  caller_branch text;
  recorded_by_customer_id uuid;
  target_booking public.bookings%rowtype;
  target_amount integer;
  target_handoff_id uuid;
  target_transaction_id uuid;
  released_count integer;
begin
  if caller_id is null then
    raise exception 'You must be logged in to send this ticket to payment.';
  end if;

  caller_role := public.current_user_role();
  caller_branch := public.current_user_branch_slug();

  if caller_role not in ('team_lead', 'BossMich') then
    raise exception 'You do not have permission to edit queue operations. Only the assigned Team Lead or BossMich can perform this action.';
  end if;

  if caller_role = 'team_lead' and caller_branch is null then
    raise exception 'Your account is not assigned to a branch. Please contact BossMich.';
  end if;

  select c.id
  into recorded_by_customer_id
  from public.customers c
  where c.id = caller_id
    and coalesce(c.is_archived, false) = false
  limit 1;

  if recorded_by_customer_id is null then
    raise exception 'Your account profile is not fully set up. Please contact an admin.';
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

  if target_booking.branch is null then
    raise exception 'Ticket is missing a branch and cannot be sent to payment.';
  end if;

  if caller_role = 'team_lead' and target_booking.branch <> caller_branch then
    raise exception 'You do not have permission to edit queue operations. Only the assigned Team Lead or BossMich can perform this action.';
  end if;

  if target_booking.status <> 'final_checking' then
    raise exception 'Ticket must be For Final Checking before it can be sent to payment.';
  end if;

  if target_booking.customer_id is null or target_booking.service_id is null then
    raise exception 'Ticket is missing required customer or service details.';
  end if;

  select coalesce(target_booking.final_price_minor, s.price_minor, 0)
  into target_amount
  from public.services s
  where s.id = target_booking.service_id;

  if coalesce(target_amount, 0) <= 0 then
    raise exception 'Ticket must have a valid final price before it can be sent to payment.';
  end if;

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
    target_amount,
    'PHP',
    'pending',
    caller_id,
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

  select t.id
  into target_transaction_id
  from public.transactions t
  where t.booking_id = target_booking.id
    and coalesce(t.is_archived, false) = false
  order by t.created_at desc
  limit 1;

  if target_transaction_id is null then
    insert into public.transactions (
      booking_id,
      customer_id,
      vehicle_id,
      pos_handoff_id,
      recorded_by,
      type,
      amount_minor,
      currency,
      description,
      occurred_at,
      status
    )
    values (
      target_booking.id,
      target_booking.customer_id,
      target_booking.vehicle_id,
      target_handoff_id,
      recorded_by_customer_id,
      'sale',
      target_amount,
      'PHP',
      'Queue ticket pending payment',
      now(),
      'pending_payment'
    )
    returning id into target_transaction_id;
  else
    update public.transactions
    set customer_id = target_booking.customer_id,
        vehicle_id = target_booking.vehicle_id,
        pos_handoff_id = target_handoff_id,
        recorded_by = recorded_by_customer_id,
        amount_minor = target_amount,
        currency = 'PHP',
        description = 'Queue ticket pending payment',
        occurred_at = now(),
        status = 'pending_payment',
        updated_at = now()
    where id = target_transaction_id;
  end if;

  update public.pos_handoffs
  set transaction_id = target_transaction_id,
      updated_at = now()
  where id = target_handoff_id;

  update public.bookings
  set status = 'for_payment',
      sent_to_payment_at = now(),
      actual_end = coalesce(actual_end, now()),
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
    caller_id,
    'Sent to payment; released ' || released_count || ' active staff assignment(s).',
    now()
  );

  return jsonb_build_object(
    'success', true,
    'booking_id', target_booking.id,
    'pos_handoff_id', target_handoff_id,
    'transaction_id', target_transaction_id,
    'released_assignments', released_count
  );
end;
$$;

create or replace function public.get_pending_payment_transactions(input_branch text default null)
returns table (
  transaction_id uuid,
  booking_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  plate_number text,
  vehicle_details text,
  service_id uuid,
  service_name text,
  final_amount_minor integer,
  branch text,
  sent_to_payment_at timestamptz,
  recorded_by uuid,
  assigned_staff text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.id as transaction_id,
    b.id as booking_id,
    b.customer_id,
    b.customer_name,
    b.customer_phone,
    b.vehicle_plate as plate_number,
    trim(concat_ws(' ', b.vehicle_year::text, b.vehicle_make, b.vehicle_model)) as vehicle_details,
    b.service_id,
    s.name as service_name,
    t.amount_minor as final_amount_minor,
    b.branch,
    coalesce(b.sent_to_payment_at, ph.handed_off_at, t.occurred_at) as sent_to_payment_at,
    t.recorded_by,
    string_agg(distinct sp.full_name, ', ' order by sp.full_name) as assigned_staff
  from public.transactions t
  join public.bookings b on b.id = t.booking_id
  left join public.services s on s.id = b.service_id
  left join public.pos_handoffs ph on ph.id = t.pos_handoff_id
  left join public.queue_assignments qa on qa.booking_id = b.id
  left join public.staff_profiles sp on sp.id = qa.staff_id
  where t.status in ('pending_payment', 'for_payment')
    and coalesce(t.is_archived, false) = false
    and (input_branch is null or b.branch = input_branch)
    and public.can_view_queue_branch(b.branch)
  group by t.id, b.id, s.name, ph.handed_off_at;
$$;

revoke all on function public.get_pending_payment_transactions(text) from public;
grant execute on function public.get_pending_payment_transactions(text) to authenticated;

commit;
