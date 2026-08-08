-- Legacy TL port: multi-service visits move through the queue as ONE unit.
-- 1) send_queue_ticket_to_payment: visit-group aware — auto-sums all line prices
--    into ONE pending handoff and moves every line to for_payment atomically.
-- 2) complete_pos_sale: paying the visit completes ALL sibling lines and awards
--    their loyalty stamps (data retention: nothing is deleted, only status moves).
-- 3) admin_override_queue_status: Branch Admin / Super Admin / ASA(queue_all) can
--    pull a ticket (whole visit) back from for_payment / final_checking to an
--    earlier lane. Pending handoffs + pending_payment transactions are cancelled,
--    never deleted.

begin;

-- ---------------------------------------------------------------------------
-- 1) Visit-group payment handoff (auto-sum)
-- ---------------------------------------------------------------------------
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

  if from_status not in ('in_progress', 'final_checking', 'for_payment', 'completed') then
    raise exception using errcode = '23514',
      message = 'Booking must be in progress, final checking, for payment, or completed';
  end if;

  if target_booking.customer_id is null or target_booking.service_id is null then
    raise exception using errcode = '23502',
      message = 'Booking requires a customer and service before payment handoff';
  end if;

  -- Whole visit moves together: lock + collect every open line in the group.
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

  -- Anchor = earliest line; the single handoff + transaction hang off it.
  select b.* into anchor_booking
  from public.bookings b
  where b.id = group_ids[1];

  -- Auto-sum: every line's price (override-aware), falling back to catalog price.
  select coalesce(sum(coalesce(b.price_minor, b.final_price_minor, s.price_minor, 0)), 0)
  into target_amount
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.id = any(group_ids);

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

  -- One handoff per visit: reuse any existing handoff on any line.
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

  -- Never leave any visit line on the Final Checking lane for the happy path.
  update public.bookings b
  set status = 'for_payment',
      final_checking_at = coalesce(b.final_checking_at, release_time),
      final_checked_by = coalesce(b.final_checked_by, caller_customer_id),
      for_payment_at = coalesce(b.for_payment_at, release_time),
      sent_to_payment_at = coalesce(b.sent_to_payment_at, release_time),
      sent_to_payment_by = coalesce(b.sent_to_payment_by, caller_customer_id),
      actual_end = coalesce(b.actual_end, release_time),
      updated_at = release_time
  where b.id = any(group_ids)
    and b.status::text in ('waiting', 'in_progress', 'final_checking');

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
      when from_status in ('waiting', 'in_progress', 'final_checking') then 'for_payment'
      else from_status
    end
  );
end;
$$;

revoke all on function public.send_queue_ticket_to_payment(uuid) from public, anon;
grant execute on function public.send_queue_ticket_to_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) POS completion closes the whole visit group + awards sibling stamps
-- ---------------------------------------------------------------------------
create or replace function public.complete_pos_sale(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  v_branch text := payload->>'branch';
  v_customer uuid := nullif(payload->>'customer_id', '')::uuid;
  v_booking uuid := nullif(payload->>'booking_id', '')::uuid;
  v_handoff uuid := nullif(payload->>'pos_handoff_id', '')::uuid;
  v_method text := coalesce(payload->>'payment_method', 'cash');
  v_status text := coalesce(payload->>'status', 'paid');
  v_notes text := nullif(trim(coalesce(payload->>'notes', '')), '');
  line jsonb;
  sale_id uuid;
  subtotal integer := 0;
  service_total integer := 0;
  line_total integer;
  qty integer;
  unit integer;
  prod_id uuid;
  svc_id uuid;
  item_name text;
  loyalty_delta integer := 0;
  stamps_awarded integer := 0;
  line_stamps integer;
  multiplier numeric := 1;
  settings public.loyalty_program_settings%rowtype;
  skip_loyalty boolean;
  sib record;
  completed_booking_count integer := 0;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'assistant_super_admin') then
    raise exception using errcode = '42501',
      message = 'Only Super Admin, Assistant Super Admin, or Admin may run POS sales';
  end if;

  if caller_role = 'assistant_super_admin' and not public.asa_has_grant('pos') then
    raise exception using errcode = '42501', message = 'POS checkout grant required';
  end if;

  if caller_role is distinct from 'BossMich'
     and not public.user_has_branch_access(v_branch) then
    raise exception using errcode = '42501',
      message = 'POS sales are limited to your assigned branch(es)';
  end if;

  if v_branch is null or not exists (
    select 1 from public.branches b where b.slug = v_branch and b.is_active and not b.is_archived
  ) then
    raise exception 'Invalid branch';
  end if;
  if v_status not in ('pending', 'paid') then
    raise exception 'Invalid sale status';
  end if;
  if jsonb_typeof(payload->'lines') is distinct from 'array' or jsonb_array_length(payload->'lines') < 1 then
    raise exception 'At least one line item is required';
  end if;

  select * into settings from public.loyalty_program_settings where id = 1;

  insert into public.sales (
    branch, customer_id, booking_id, pos_handoff_id, status, payment_method,
    subtotal_minor, total_minor, notes, recorded_by
  ) values (
    v_branch, v_customer, v_booking, v_handoff, v_status, v_method, 0, 0, v_notes, caller
  ) returning id into sale_id;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    qty := greatest(coalesce((line->>'quantity')::int, 1), 1);
    unit := coalesce((line->>'unit_price_minor')::int, 0);
    line_total := qty * unit;
    subtotal := subtotal + line_total;
    item_name := coalesce(line->>'name', 'Item');
    skip_loyalty := coalesce((line->>'is_loyalty_award')::boolean, false)
      or coalesce((line->>'is_membership_included')::boolean, false);

    if line->>'item_type' = 'product' then
      prod_id := (line->>'product_id')::uuid;
      update public.products p
      set stock_qty = p.stock_qty - qty, updated_at = clock_timestamp()
      where p.id = prod_id and p.stock_qty >= qty and p.is_active and not p.is_archived;
      if not found then
        raise exception 'Insufficient stock for product %', prod_id;
      end if;
      insert into public.product_stock_movements (product_id, delta, reason, sale_id, created_by)
      values (prod_id, -qty, 'pos_sale', sale_id, caller);
      insert into public.sale_line_items (
        sale_id, item_type, product_id, name, quantity, unit_price_minor, line_total_minor
      ) values (sale_id, 'product', prod_id, item_name, qty, unit, line_total);
    elsif line->>'item_type' = 'service' then
      svc_id := (line->>'service_id')::uuid;
      service_total := service_total + line_total;
      insert into public.sale_line_items (
        sale_id, item_type, service_id, name, quantity, unit_price_minor, line_total_minor
      ) values (sale_id, 'service', svc_id, item_name, qty, unit, line_total);
      if v_status = 'paid' and v_customer is not null and not skip_loyalty
         and coalesce(settings.stamps_enabled, true) then
        line_stamps := public.award_loyalty_stamps(v_customer, svc_id, qty);
        stamps_awarded := stamps_awarded + coalesce(line_stamps, 0);
      end if;
    else
      raise exception 'Invalid item_type';
    end if;
  end loop;

  update public.sales
  set subtotal_minor = subtotal, total_minor = subtotal, updated_at = clock_timestamp()
  where id = sale_id;

  if v_status = 'paid' and v_customer is not null and service_total > 0
     and coalesce(settings.points_enabled, true) then
    multiplier := 1;
    if coalesce(settings.memberships_enabled, true) then
      select coalesce(mt.loyalty_multiplier, 1) into multiplier
      from public.customer_memberships cm
      join public.membership_tiers mt on mt.id = cm.tier_id
      where cm.customer_id = v_customer
        and cm.is_active
        and mt.is_active
        and (cm.ends_at is null or cm.ends_at >= (timezone('Asia/Manila', now()))::date)
      order by cm.created_at desc
      limit 1;
    end if;

    loyalty_delta := greatest(floor((service_total / 100.0) * coalesce(multiplier, 1))::int, 0);
    if loyalty_delta > 0 then
      insert into public.loyalty_ledger (customer_id, delta, reason, sale_id)
      values (v_customer, loyalty_delta, 'service_sale', sale_id);
      update public.customers
      set loyalty_points = loyalty_points + loyalty_delta, updated_at = clock_timestamp()
      where id = v_customer;
    end if;
  end if;

  if v_handoff is not null and v_status = 'paid' then
    update public.pos_handoffs
    set status = 'completed', completed_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = v_handoff;
  end if;

  if v_booking is not null and v_status = 'paid' then
    update public.bookings
    set status = 'completed', completed_at = coalesce(completed_at, clock_timestamp()), updated_at = clock_timestamp()
    where id = v_booking;
    completed_booking_count := 1;

    -- Multi-service visit: one payment closes every sibling line and
    -- awards each sibling service its loyalty stamps (single summed handoff line
    -- only carries the anchor service).
    for sib in
      select b.id, b.customer_id, b.service_id
      from public.bookings b
      where b.visit_group_id is not null
        and b.visit_group_id = (select vb.visit_group_id from public.bookings vb where vb.id = v_booking)
        and b.id <> v_booking
        and not coalesce(b.is_archived, false)
        and b.status::text in ('waiting', 'in_progress', 'final_checking', 'for_payment')
    loop
      update public.bookings
      set status = 'completed', completed_at = coalesce(completed_at, clock_timestamp()), updated_at = clock_timestamp()
      where id = sib.id;
      completed_booking_count := completed_booking_count + 1;

      if v_status = 'paid' and sib.customer_id is not null and sib.service_id is not null
         and coalesce(settings.stamps_enabled, true) then
        line_stamps := public.award_loyalty_stamps(sib.customer_id, sib.service_id, 1);
        stamps_awarded := stamps_awarded + coalesce(line_stamps, 0);
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'sale_id', sale_id,
    'total_minor', subtotal,
    'loyalty_awarded', coalesce(loyalty_delta, 0),
    'stamps_awarded', coalesce(stamps_awarded, 0),
    'completed_booking_count', completed_booking_count
  );
end;
$$;

revoke all on function public.complete_pos_sale(jsonb) from public, anon;
grant execute on function public.complete_pos_sale(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Admin override: bring a ticket (whole visit) back to an earlier lane
-- ---------------------------------------------------------------------------
create or replace function public.admin_override_queue_status(
  input_booking_id uuid,
  input_next_status text,
  input_reason text default null
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
  group_ids uuid[];
  from_status text;
  next_status text := lower(trim(coalesce(input_next_status, '')));
  release_time timestamptz := clock_timestamp();
  cancelled_handoffs integer := 0;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'assistant_super_admin') then
    raise exception using errcode = '42501',
      message = 'Only Branch Admin, Super Admin, or Assistant Super Admin may override queue status';
  end if;

  if caller_role = 'assistant_super_admin' and not public.asa_has_grant('queue_all') then
    raise exception using errcode = '42501',
      message = 'Queue override requires the queue_all grant';
  end if;

  if next_status not in ('waiting', 'in_progress', 'final_checking') then
    raise exception using errcode = '23514',
      message = 'Override target must be waiting, in progress, or final checking';
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
      message = 'You do not have access to override this branch booking';
  end if;

  from_status := target_booking.status::text;
  if from_status not in ('waiting', 'in_progress', 'final_checking', 'for_payment', 'redo') then
    raise exception using errcode = '23514',
      message = 'Only open queue tickets can be overridden';
  end if;
  if from_status = next_status then
    raise exception using errcode = '23514', message = 'Ticket is already in that status';
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

  -- Leaving for_payment: cancel (never delete) pending handoffs + transactions.
  update public.pos_handoffs ph
  set status = 'cancelled', updated_at = release_time
  where ph.booking_id = any(group_ids)
    and ph.status = 'pending';
  get diagnostics cancelled_handoffs = row_count;

  update public.transactions t
  set status = 'cancelled', updated_at = release_time
  where t.status = 'pending_payment'
    and t.pos_handoff_id in (
      select ph.id from public.pos_handoffs ph where ph.booking_id = any(group_ids)
    );

  update public.bookings b
  set status = next_status::public.booking_status,
      waiting_at = case when next_status = 'waiting' then release_time else b.waiting_at end,
      in_progress_at = case when next_status = 'in_progress' then release_time else b.in_progress_at end,
      actual_start = case when next_status = 'in_progress' then coalesce(b.actual_start, release_time) else b.actual_start end,
      final_checking_at = case when next_status = 'final_checking' then release_time else b.final_checking_at end,
      updated_at = release_time
  where b.id = any(group_ids);

  insert into public.queue_events (booking_id, branch, old_status, new_status, notes)
  values (
    target_booking.id,
    target_booking.branch,
    from_status,
    next_status,
    'Admin override' || case when nullif(trim(coalesce(input_reason, '')), '') is null
      then '' else ': ' || trim(input_reason) end
  );

  return jsonb_build_object(
    'booking_id', target_booking.id,
    'group_booking_ids', to_jsonb(group_ids),
    'from_status', from_status,
    'to_status', next_status,
    'cancelled_handoffs', cancelled_handoffs
  );
end;
$$;

revoke all on function public.admin_override_queue_status(uuid, text, text) from public, anon;
grant execute on function public.admin_override_queue_status(uuid, text, text) to authenticated;

commit;
