-- Shop-day lifecycle probe: one same-day Carwash ticket from waiting to paid,
-- driven by the real roles the way PostgREST does (role authenticated +
-- request.jwt.claims), plus the refusals that must hold along the way.
--
-- Unlike probe-rls-role-matrix.sql, each step KEEPS its effect so the next
-- step sees it. The whole run ALWAYS ends in `raise exception`, so every row
-- it wrote is rolled back and today's real books are untouched. The result
-- JSON is in the error message: {"pass": n, "fail": n, "cases": {...}}.
--
-- Outcomes: 'ok:V' = statement ran (V = first column for selects/returning,
-- otherwise rows touched), 'err:SQLSTATE message' = statement refused.

create or replace function pg_temp.act(p_uid uuid, p_sql text) returns text
language plpgsql as $f$
declare v text; n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
  if p_sql ilike 'select%' or p_sql ilike '%returning%' then
    execute p_sql into v;
  else
    execute p_sql;
    get diagnostics n = row_count;
    v := n::text;
  end if;
  execute 'reset role';
  return 'ok:' || coalesce(v, 'null');
exception
  when others then return 'err:' || sqlstate || ' ' || left(sqlerrm, 160);
end $f$;

do $$
declare
  svc constant uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd'; -- Carwash (wash)
  pkg constant uuid := 'c6310f2b-0451-4092-851f-1a5169e53992'; -- Express Wash Package
  price constant int := 35000;                                  -- medium size
  tl uuid; crew uuid; absent uuid; ba uuid; bk2 uuid; bk3 uuid; grp uuid;
  plate text := 'QAPRB' || to_char(clock_timestamp(), 'MISSMS');
  today date := (timezone('Asia/Manila', now()))::date;
  bk uuid; ho uuid; sale uuid; out text; sent jsonb; rung jsonb;
  got jsonb := '{}'; want jsonb; k text; w text; v text;
  pass int := 0; fail int := 0; res jsonb := '{}';
begin
  select id into tl   from public.staff_profiles where role::text = 'team_lead' and branch_slug = 'bacoor' and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into crew from public.staff_profiles where role::text = 'staff'     and branch_slug = 'bacoor' and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into ba   from public.staff_profiles where role::text = 'admin'     and branch_slug = 'bacoor' and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into absent from public.staff_profiles sp where role::text = 'staff' and branch_slug = 'bacoor' and coalesce(is_active,false) and not coalesce(is_archived,false) and id <> crew
     and not exists (select 1 from public.staff_attendance a where a.staff_id = sp.id and a.attendance_date = today and a.status in ('present','late'))
   order by created_at limit 1;
  if tl is null or crew is null or absent is null or ba is null then
    raise exception 'PROBE fixtures missing: tl=% crew=% absent=% ba=%', tl, crew, absent, ba;
  end if;

  -- C1: crew is on the floor (Branch Admin marks attendance; geo clock-in needs a phone GPS).
  got := got || jsonb_build_object('ba_marks_crew_present', pg_temp.act(ba, format(
    'insert into public.staff_attendance (staff_id, branch_slug, attendance_date, status, checked_in_at, marked_by)
     values (%L, ''bacoor'', %L, ''present'', now(), %L)
     on conflict do nothing', crew, today, ba)));

  -- C2: Team Lead creates the walk-in ticket (createQueueTicket: vehicle upsert, then booking).
  got := got || jsonb_build_object('tl_creates_vehicle', pg_temp.act(tl, format(
    'insert into public.vehicles (plate_number, normalized_plate_number, vehicle_make, vehicle_model, vehicle_type, last_branch)
     values (%L, %L, '''', '''', ''medium'', ''bacoor'') returning ''1''', plate, plate)));
  out := pg_temp.act(tl, format(
    'insert into public.bookings (service_id, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_plate, vehicle_type,
       vehicle_id, scheduled_start, branch, status, team_lead_id, waiting_at, final_price_minor, price_minor)
     values (%L, %L, '''', '''', '''', %L, ''medium'',
       (select id from public.vehicles where normalized_plate_number = %L), now(), ''bacoor'', ''waiting'', %L, now(), %s, %s)
     returning id', svc, 'Walk-in · ' || plate, plate, plate, tl, price, price));
  if out like 'ok:%' then bk := substr(out, 4)::uuid; out := 'ok:1'; end if;
  got := got || jsonb_build_object('tl_creates_ticket', out);
  if bk is null then raise exception 'PROBE stopped: %', got::text; end if;

  -- Refusals before the work starts.
  got := got || jsonb_build_object('crew_cannot_move_ticket', pg_temp.act(crew, format(
    'update public.bookings set status = ''in_progress'', in_progress_at = now() where id = %L', bk)));
  got := got || jsonb_build_object('tl_cannot_start_without_crew', pg_temp.act(tl, format(
    'update public.bookings set status = ''in_progress'', in_progress_at = now() where id = %L', bk)));

  -- C3: Team Lead assigns present crew, starts, final-checks.
  got := got || jsonb_build_object('tl_cannot_assign_absent_crew', pg_temp.act(tl, format(
    'select ''1'' from public.sync_queue_assignments(%L::uuid, array[%L::uuid])', bk, absent)));
  got := got || jsonb_build_object('tl_assigns_crew', pg_temp.act(tl, format(
    'select ''1'' from public.sync_queue_assignments(%L::uuid, array[%L::uuid])', bk, crew)));
  got := got || jsonb_build_object('tl_starts_service', pg_temp.act(tl, format(
    'update public.bookings set status = ''in_progress'', in_progress_at = now(), actual_start = now() where id = %L', bk)));
  got := got || jsonb_build_object('tl_final_check', pg_temp.act(tl, format(
    'update public.bookings set status = ''final_checking'', final_checking_at = now(), final_checked_by = %L where id = %L', tl, bk)));

  -- C4: Team Lead hands off to POS.
  out := pg_temp.act(tl, format('select public.send_queue_ticket_to_payment(%L::uuid)::text', bk));
  if out like 'ok:%' then sent := substr(out, 4)::jsonb; ho := (sent->>'handoff_id')::uuid; out := 'ok:1'; end if;
  got := got || jsonb_build_object('tl_sends_to_payment', out);
  if ho is null then raise exception 'PROBE stopped: %', got::text; end if;

  -- Only the Branch Admin rings the sale.
  got := got || jsonb_build_object('tl_cannot_ring_sale', pg_temp.act(tl, format(
    'select public.complete_pos_sale(%L::jsonb)::text', jsonb_build_object(
      'branch','bacoor','booking_id',bk,'pos_handoff_id',ho,'payment_method','cash','status','paid','discount_minor',0,
      'lines', jsonb_build_array(jsonb_build_object('item_type','service','service_id',svc,'name','Carwash','quantity',1,
        'unit_price_minor',price,'vehicle_size','medium'))))));

  -- D1: Branch Admin collects cash at POS.
  out := pg_temp.act(ba, format(
    'select public.complete_pos_sale(%L::jsonb)::text', jsonb_build_object(
      'branch','bacoor','customer_id',null,'booking_id',bk,'pos_handoff_id',ho,'payment_method','cash','payment_ref',null,
      'discount_reason',null,'discount_minor',0,'status','paid','notes',null,
      'lines', jsonb_build_array(jsonb_build_object('item_type','service','service_id',svc,'product_id',null,'name','Carwash',
        'quantity',1,'unit_price_minor',price,'is_loyalty_award',false,'is_birthday_award',false,
        'is_membership_included',false,'vehicle_size','medium')))));
  if out like 'ok:%' then rung := substr(out, 4)::jsonb; sale := (rung->>'sale_id')::uuid; out := 'ok:1'; end if;
  got := got || jsonb_build_object('ba_rings_cash_sale', out);

  -- End state, read as the owner.
  got := got
    || jsonb_build_object('booking_completed',   (select status from public.bookings where id = bk))
    || jsonb_build_object('sale_paid_amount',    (select status || ':' || total_minor from public.sales where id = sale))
    || jsonb_build_object('handoff_closed',      (select status from public.pos_handoffs where id = ho))
    || jsonb_build_object('crew_released',       (select count(*) from public.queue_assignments where booking_id = bk and status = 'active')::text);

  -- Packages run without crew (crewRequiredForPayCategory).
  out := pg_temp.act(tl, format(
    'insert into public.bookings (service_id, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_plate, vehicle_type,
       scheduled_start, branch, status, team_lead_id, waiting_at, final_price_minor, price_minor)
     values (%L, %L, '''', '''', '''', %L, ''medium'', now(), ''bacoor'', ''waiting'', %L, now(), 80000, 80000)
     returning id', pkg, 'Walk-in · ' || plate || 'P', plate || 'P', tl));
  if out like 'ok:%' then bk2 := substr(out, 4)::uuid; end if;
  got := got || jsonb_build_object('tl_starts_package_without_crew', pg_temp.act(tl, format(
    'update public.bookings set status = ''in_progress'', in_progress_at = now() where id = %L', bk2)));

  -- A Branch Admin override still pulls a paid-pending wash back to work after its crew was released.
  out := pg_temp.act(tl, format(
    'insert into public.bookings (service_id, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_plate, vehicle_type,
       scheduled_start, branch, status, team_lead_id, waiting_at, final_price_minor, price_minor)
     values (%L, %L, '''', '''', '''', %L, ''medium'', now(), ''bacoor'', ''waiting'', %L, now(), %s, %s)
     returning id', svc, 'Walk-in · ' || plate || 'O', plate || 'O', tl, price, price));
  if out like 'ok:%' then bk3 := substr(out, 4)::uuid; end if;
  perform pg_temp.act(tl, format('select ''1'' from public.sync_queue_assignments(%L::uuid, array[%L::uuid])', bk3, crew));
  perform pg_temp.act(tl, format('update public.bookings set status = ''in_progress'' where id = %L', bk3));
  perform pg_temp.act(tl, format('select public.send_queue_ticket_to_payment(%L::uuid)::text', bk3));
  got := got || jsonb_build_object('ba_override_back_to_work', pg_temp.act(ba, format(
    'select public.admin_override_queue_status(%L::uuid, ''in_progress'', ''probe: customer asked for a re-rinse'')->>''to_status''', bk3)));

  -- Multi-service visit: crew sits on the first line, and every line starts in one update (updateTicketStatus).
  grp := gen_random_uuid();
  perform pg_temp.act(tl, format(
    'insert into public.bookings (service_id, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_plate, vehicle_type,
       scheduled_start, branch, status, team_lead_id, waiting_at, final_price_minor, price_minor, visit_group_id)
     select s, %L, '''', '''', '''', %L, ''medium'', now(), ''bacoor'', ''waiting'', %L, now(), %s, %s, %L
     from unnest(array[%L::uuid, %L::uuid]) s returning ''1''',
    'Walk-in · ' || plate || 'V', plate || 'V', tl, price, price, grp, svc, svc));
  perform pg_temp.act(tl, format(
    'select ''1'' from public.sync_queue_assignments((select id from public.bookings where visit_group_id = %L order by created_at, id limit 1), array[%L::uuid])', grp, crew));
  got := got || jsonb_build_object('tl_starts_whole_visit', pg_temp.act(tl, format(
    'update public.bookings set status = ''in_progress'' where visit_group_id = %L', grp)));

  want := jsonb_build_object(
    'ba_marks_crew_present',   'ok:1',
    'tl_creates_vehicle',      'ok:1',
    'tl_creates_ticket',       'ok:1',
    'crew_cannot_move_ticket', 'ok:0',
    'tl_cannot_start_without_crew', 'err',
    'tl_assigns_crew',         'ok:1',
    'tl_starts_service',       'ok:1',
    'tl_final_check',          'ok:1',
    'tl_sends_to_payment',     'ok:1',
    'tl_cannot_ring_sale',     'err',
    'ba_rings_cash_sale',      'ok:1',
    'booking_completed',       'completed',
    'sale_paid_amount',        'paid:' || price,
    'handoff_closed',          'completed',
    'crew_released',           '0',
    'tl_cannot_assign_absent_crew',   'err',
    'tl_starts_package_without_crew', 'ok:1',
    'ba_override_back_to_work',       'ok:in_progress',
    'tl_starts_whole_visit',          'ok:2');

  for k, w in select key, value #>> '{}' from jsonb_each(want) loop
    v := coalesce(got->>k, 'missing');
    if (w = 'err' and v like 'err:%') or v = w then pass := pass + 1;
    else fail := fail + 1; res := res || jsonb_build_object(k, jsonb_build_object('got', v, 'want', w));
    end if;
  end loop;

  raise exception 'PROBE %', jsonb_build_object('pass', pass, 'fail', fail, 'failures', res, 'cases', got)::text;
end $$;
