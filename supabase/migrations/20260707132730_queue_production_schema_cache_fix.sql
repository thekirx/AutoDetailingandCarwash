-- Production Queue System schema-cache and payment handoff fix.
-- Adds missing queue tracking columns and refreshes the payment RPC so
-- transactions.recorded_by always uses a valid public.customers(id).

alter type public.booking_status add value if not exists 'waiting';
alter type public.booking_status add value if not exists 'final_checking';
alter type public.booking_status add value if not exists 'for_payment';
alter type public.profile_role add value if not exists 'BossMich';

alter table public.bookings
add column if not exists waiting_at timestamptz,
add column if not exists in_progress_at timestamptz,
add column if not exists final_checking_at timestamptz,
add column if not exists for_payment_at timestamptz,
add column if not exists sent_to_payment_at timestamptz,
add column if not exists completed_at timestamptz,
add column if not exists cancelled_at timestamptz,
add column if not exists queue_number text,
add column if not exists team_lead_id uuid references public.customers(id) on delete set null,
add column if not exists price_minor integer,
add column if not exists final_checked_by uuid references public.customers(id) on delete set null,
add column if not exists sent_to_payment_by uuid references public.customers(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_price_minor_nonnegative'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
    add constraint bookings_price_minor_nonnegative
    check (price_minor is null or price_minor >= 0);
  end if;
end;
$$;

update public.bookings
set price_minor = final_price_minor
where price_minor is null
  and final_price_minor is not null;

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
    raise exception 'Your user profile is missing. Ask Super Admin to create or sync your profile before sending to payment.';
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

  select coalesce(target_booking.price_minor, target_booking.final_price_minor, s.price_minor, 0)
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
      payment_method,
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
      'pending',
      'Pending payment from queue ticket',
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
        payment_method = coalesce(payment_method, 'pending'),
        description = 'Pending payment from queue ticket',
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
      for_payment_at = now(),
      sent_to_payment_at = now(),
      sent_to_payment_by = recorded_by_customer_id,
      price_minor = target_amount,
      final_price_minor = coalesce(final_price_minor, target_amount),
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

revoke all on function public.send_queue_ticket_to_payment(uuid) from public;
grant execute on function public.send_queue_ticket_to_payment(uuid) to authenticated;

notify pgrst, 'reload schema';
