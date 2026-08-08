-- Final check must leave the floor board: in_progress → for_payment atomically.
-- Stamps final_checking_at for QC timing, but never leaves status stuck at final_checking.
-- staff_profiles-only ops users may not have a customers row — do not require it for handoff.

begin;

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
  from_status text;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'assistant_super_admin', 'team_lead') then
    raise exception using errcode = '42501',
      message = 'Only Super Admin, Assistant Super Admin, Admin, or Team Lead may send a booking to payment';
  end if;

  if caller_role = 'assistant_super_admin' and not public.asa_has_grant('queue_all') then
    raise exception using errcode = '42501',
      message = 'Sending to payment requires the queue_all grant';
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
      message = 'You do not have access to send this branch booking to payment';
  end if;

  from_status := target_booking.status::text;

  -- Happy path: in_progress final-check → payment. Retry: final_checking → payment.
  if from_status not in ('in_progress', 'final_checking', 'for_payment', 'completed') then
    raise exception using errcode = '23514',
      message = 'Booking must be in progress, final checking, for payment, or completed';
  end if;

  if target_booking.customer_id is null or target_booking.service_id is null then
    raise exception using errcode = '23502',
      message = 'Booking requires a customer and service before payment handoff';
  end if;

  select coalesce(target_booking.price_minor, target_booking.final_price_minor, s.price_minor, 0)
  into target_amount
  from public.services s
  where s.id = target_booking.service_id;

  if coalesce(target_amount, 0) <= 0 then
    raise exception using errcode = '23514', message = 'Booking requires a positive payment amount';
  end if;

  -- Optional: staff may only exist in staff_profiles (no customers mirror).
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
        status = case when ph.status = 'completed' then ph.status else 'pending' end,
        handed_off_by = coalesce(ph.handed_off_by, caller_id),
        handed_off_at = coalesce(ph.handed_off_at, release_time),
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

  -- Never leave the ticket on the Final Checking lane for the happy path.
  if from_status in ('in_progress', 'final_checking') then
    update public.bookings b
    set status = 'for_payment',
        final_checking_at = coalesce(b.final_checking_at, release_time),
        final_checked_by = coalesce(b.final_checked_by, caller_customer_id),
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
    'handoff_created', handoff_created,
    'from_status', from_status,
    'to_status', case
      when from_status in ('in_progress', 'final_checking') then 'for_payment'
      else from_status
    end
  );
end;
$$;

revoke all on function public.send_queue_ticket_to_payment(uuid) from public, anon;
grant execute on function public.send_queue_ticket_to_payment(uuid) to authenticated;

-- Repair tickets already stuck in final_checking with a pending handoff (idempotent).
update public.bookings b
set status = 'for_payment',
    for_payment_at = coalesce(b.for_payment_at, b.sent_to_payment_at, clock_timestamp()),
    sent_to_payment_at = coalesce(b.sent_to_payment_at, b.for_payment_at, clock_timestamp()),
    updated_at = clock_timestamp()
where b.status = 'final_checking'
  and not coalesce(b.is_archived, false)
  and exists (
    select 1
    from public.pos_handoffs ph
    where ph.booking_id = b.id
      and ph.status = 'pending'
  );

commit;
