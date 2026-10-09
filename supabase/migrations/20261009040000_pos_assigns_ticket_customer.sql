-- Team Leads no longer collect the customer's name/contact. Branch Admin captures it at POS.
--   1. A ticket may reach payment without a customer (customer_id null, phone '').
--   2. assign_queue_ticket_customer() moves a ticket (and its visit group, handoff, pending
--      transaction and vehicle) onto one customer — the single write path POS uses.
--   3. The completion SMS trigger ignores blank phones.

-- 1 ---------------------------------------------------------------------------------------
create or replace function public.send_queue_ticket_to_payment(input_booking_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  caller_customer_id uuid;
  target_booking public.bookings%rowtype;
  anchor_booking public.bookings%rowtype;
  group_ids uuid[];
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

  if from_status not in ('in_progress', 'final_checking', 'for_releasing', 'for_payment', 'completed') then
    raise exception using errcode = '23514',
      message = 'Booking must be in progress, final checking, for releasing, for payment, or completed';
  end if;

  -- Customer is optional here: Branch Admin attaches name/phone/email at the POS counter.
  if target_booking.service_id is null then
    raise exception using errcode = '23502',
      message = 'Booking requires a service before payment handoff';
  end if;

  if target_booking.visit_group_id is not null then
    select array_agg(id) into group_ids
    from (
      select b.id
      from public.bookings b
      where b.visit_group_id = target_booking.visit_group_id
        and not coalesce(b.is_archived, false)
        and b.status::text not in ('completed', 'cancelled')
      order by b.created_at
      for update
    ) locked;
  end if;
  if group_ids is null or array_length(group_ids, 1) is null then
    group_ids := array[target_booking.id];
  end if;

  select b.* into anchor_booking
  from public.bookings b
  where b.id = group_ids[1];

  select coalesce(sum(coalesce(b.price_minor, b.final_price_minor, s.price_minor, 0)), 0)
  into target_amount
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.id = any(group_ids);

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
  where ph.booking_id = any(group_ids)
  order by ph.created_at
  limit 1
  for update;

  if not found then
    insert into public.pos_handoffs (
      booking_id, customer_id, vehicle_id, branch, amount_minor,
      currency, status, handed_off_by, handed_off_at
    )
    values (
      anchor_booking.id, anchor_booking.customer_id, anchor_booking.vehicle_id,
      anchor_booking.branch, target_amount, 'PHP', 'pending', caller_id,
      release_time
    )
    returning * into target_handoff;
    handoff_created := true;
  else
    update public.pos_handoffs ph
    set customer_id = anchor_booking.customer_id,
        vehicle_id = anchor_booking.vehicle_id,
        branch = anchor_booking.branch,
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
    where t.booking_id = target_handoff.booking_id
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
      target_handoff.booking_id, anchor_booking.customer_id, anchor_booking.vehicle_id,
      target_handoff.id, caller_customer_id, 'sale', target_amount, 'PHP',
      'Queue ticket pending payment', release_time, 'pending_payment'
    )
    returning id into target_transaction_id;
  else
    update public.transactions t
    set customer_id = anchor_booking.customer_id,
        vehicle_id = anchor_booking.vehicle_id,
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

  update public.bookings b
  set status = 'for_payment',
      final_checking_at = coalesce(b.final_checking_at, release_time),
      final_checked_by = coalesce(b.final_checked_by, caller_id),
      for_payment_at = coalesce(b.for_payment_at, release_time),
      sent_to_payment_at = coalesce(b.sent_to_payment_at, release_time),
      sent_to_payment_by = coalesce(b.sent_to_payment_by, caller_id),
      actual_end = coalesce(b.actual_end, release_time),
      updated_at = release_time
  where b.id = any(group_ids)
    and b.status::text in ('waiting', 'in_progress', 'final_checking', 'for_releasing');

  update public.queue_assignments qa
  set status = 'released',
      released_at = coalesce(qa.released_at, release_time),
      completed_at = coalesce(qa.completed_at, qa.released_at, release_time)
  where qa.booking_id = any(group_ids)
    and qa.status = 'active';

  get diagnostics released_count = row_count;

  return jsonb_build_object(
    'booking_id', target_booking.id,
    'anchor_booking_id', target_handoff.booking_id,
    'group_booking_ids', to_jsonb(group_ids),
    'amount_minor', target_amount,
    'handoff_id', target_handoff.id,
    'released_assignment_count', released_count,
    'handoff_created', handoff_created,
    'from_status', from_status,
    'to_status', case
      when from_status in ('waiting', 'in_progress', 'final_checking', 'for_releasing') then 'for_payment'
      else from_status
    end
  );
end;
$function$;

-- 2 ---------------------------------------------------------------------------------------
create or replace function public.assign_queue_ticket_customer(
  p_booking_id uuid,
  p_customer_id uuid
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  b public.bookings%rowtype;
  c public.customers%rowtype;
  group_ids uuid[];
  v_email text;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'assistant_super_admin') then
    raise exception using errcode = '42501',
      message = 'Only Admin, Super Admin, or Assistant Super Admin can set a ticket customer at POS';
  end if;
  if caller_role = 'assistant_super_admin' and not public.asa_has_grant('pos') then
    raise exception using errcode = '42501', message = 'POS checkout grant required';
  end if;

  select * into b
  from public.bookings
  where id = p_booking_id and not coalesce(is_archived, false)
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  if not public.user_has_branch_access(b.branch) then
    raise exception using errcode = '42501', message = 'POS is limited to your assigned branch(es)';
  end if;
  if b.status::text in ('completed', 'cancelled') then
    raise exception using errcode = '23514', message = 'This ticket is already closed';
  end if;

  select * into c
  from public.customers
  where id = p_customer_id
    and role = 'customer'
    and not coalesce(is_archived, false);
  if not found then
    raise exception using errcode = 'P0002', message = 'Customer not found';
  end if;

  select coalesce(array_agg(x.id), array[b.id]) into group_ids
  from (
    select id
    from public.bookings
    where b.visit_group_id is not null
      and visit_group_id = b.visit_group_id
      and not coalesce(is_archived, false)
      and status::text not in ('completed', 'cancelled')
    order by created_at
    for update
  ) x;

  -- Synthetic phone-login addresses are not real contact emails.
  v_email := case
    when c.email is null or c.email ilike '%@customers.hakumautocare.com' then null
    else c.email
  end;

  update public.bookings
  set customer_id = c.id,
      customer_name = c.full_name,
      customer_phone = coalesce(nullif(trim(c.phone), ''), nullif(trim(customer_phone), ''), ''),
      customer_email = coalesce(v_email, customer_email),
      updated_at = clock_timestamp()
  where id = any(group_ids);

  update public.pos_handoffs
  set customer_id = c.id, updated_at = clock_timestamp()
  where booking_id = any(group_ids) and status is distinct from 'completed';

  update public.transactions
  set customer_id = c.id, updated_at = clock_timestamp()
  where booking_id = any(group_ids) and status = 'pending_payment';

  update public.vehicles
  set customer_id = c.id, updated_at = clock_timestamp()
  where id in (select vehicle_id from public.bookings where id = any(group_ids) and vehicle_id is not null);

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller, caller_role, 'pos.ticket_customer', 'booking', b.id::text,
    format('POS set ticket customer · %s', c.full_name),
    jsonb_build_object('customer_id', c.id, 'booking_ids', to_jsonb(group_ids), 'previous_customer_id', b.customer_id)
  );

  return jsonb_build_object(
    'customer_id', c.id,
    'full_name', c.full_name,
    'phone', coalesce(nullif(trim(c.phone), ''), ''),
    'email', v_email,
    'booking_ids', to_jsonb(group_ids)
  );
end;
$function$;

revoke all on function public.assign_queue_ticket_customer(uuid, uuid) from public, anon;
grant execute on function public.assign_queue_ticket_customer(uuid, uuid) to authenticated;

-- 3 ---------------------------------------------------------------------------------------
create or replace function public.create_completion_sms_event()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  service_name text;
  sms_message text;
begin
  if new.status::text = 'completed'
     and old.status is distinct from new.status
     and nullif(trim(new.customer_phone), '') is not null then

    select name
    into service_name
    from public.services
    where id = new.service_id;

    sms_message := 'Thank you for choosing Hakum Auto Care '
      || coalesce(initcap(new.branch), '')
      || '. Your '
      || coalesce(service_name, 'service')
      || ' is now completed.';

    insert into public.sms_events (
      booking_id,
      customer_id,
      vehicle_id,
      phone,
      event_type,
      message,
      provider,
      status,
      created_at
    )
    select
      new.id,
      new.customer_id,
      new.vehicle_id,
      new.customer_phone,
      'post_service_completed',
      sms_message,
      'twilio',
      'pending',
      now()
    where not exists (
      select 1
      from public.sms_events
      where booking_id = new.id
        and event_type = 'post_service_completed'
    );
  end if;

  return new;
end;
$function$;
