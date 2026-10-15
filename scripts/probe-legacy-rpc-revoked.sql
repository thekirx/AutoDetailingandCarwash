-- BUG-093 probe: legacy SECURITY DEFINER RPCs still callable from the browser.
--
--   complete_payment  closes a car at the counter with no sales row, so the money
--                     never reaches the Daily Sheet. Only the retired cashier role
--                     is branch-scoped, so any Branch Admin can close any branch's car.
--   ops_lab_write_audit / resolve_ops_lab_notify_user_ids  belong to the retired
--                     Ops Lab and run for any signed-in user, customers included.
--
-- Drives them as the real roles the way PostgREST does (role authenticated +
-- request.jwt.claims). Always ends in `raise exception`, so the ticket it opens is
-- rolled back. Read the JSON in the message: {"pass": n, "fail": n, "cases": {...}}.

create or replace function pg_temp.act(p_uid uuid, p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
  execute p_sql into v;
  execute 'reset role';
  return 'ok:' || coalesce(v, 'null');
exception
  when others then return 'err:' || sqlstate || ' ' || left(sqlerrm, 120);
end $f$;

do $$
declare
  svc constant uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd'; -- Carwash (wash)
  price constant int := 35000;
  today date := (timezone('Asia/Manila', now()))::date;
  plate text := 'QALEG' || to_char(clock_timestamp(), 'MISSMS');
  tl uuid; crew uuid; ba uuid; other_ba uuid; cust uuid; bk uuid; ho uuid; out text;
  got jsonb := '{}'; want jsonb; k text; w text; v text;
  pass int := 0; fail int := 0; res jsonb := '{}';
begin
  select id into tl       from public.staff_profiles where role::text = 'team_lead' and branch_slug = 'bacoor'   and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into crew     from public.staff_profiles where role::text = 'staff'     and branch_slug = 'bacoor'   and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into ba       from public.staff_profiles where role::text = 'admin'     and branch_slug = 'bacoor'   and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into other_ba from public.staff_profiles where role::text = 'admin'     and branch_slug = 'batangas' and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select c.id into cust from public.customers c join auth.users u on u.id = c.id
   where not coalesce(c.is_archived,false) and not exists (select 1 from public.staff_profiles sp where sp.id = c.id)
   order by c.created_at limit 1;
  if tl is null or crew is null or ba is null or other_ba is null or cust is null then
    raise exception 'PROBE fixtures missing: tl=% crew=% ba=% other_ba=% customer=%', tl, crew, ba, other_ba, cust;
  end if;

  -- A Bacoor car waiting at the counter, set up the way the floor does it.
  perform pg_temp.act(ba, format(
    'insert into public.staff_attendance (staff_id, branch_slug, attendance_date, status, checked_in_at, marked_by)
     values (%L, ''bacoor'', %L, ''present'', now(), %L) on conflict do nothing returning ''1''', crew, today, ba));
  out := pg_temp.act(tl, format(
    'insert into public.bookings (service_id, customer_name, customer_phone, vehicle_make, vehicle_model, vehicle_plate, vehicle_type,
       scheduled_start, branch, status, team_lead_id, waiting_at, final_price_minor, price_minor)
     values (%L, %L, '''', '''', '''', %L, ''medium'', now(), ''bacoor'', ''waiting'', %L, now(), %s, %s)
     returning id', svc, 'Walk-in · ' || plate, plate, tl, price, price));
  if out like 'ok:%' then bk := substr(out, 4)::uuid; end if;
  if bk is null then raise exception 'PROBE stopped: ticket %', out; end if;
  perform pg_temp.act(tl, format('select ''1'' from public.sync_queue_assignments(%L::uuid, array[%L::uuid])', bk, crew));
  perform pg_temp.act(tl, format('update public.bookings set status = ''in_progress'', in_progress_at = now() where id = %L returning ''1''', bk));
  perform pg_temp.act(tl, format('update public.bookings set status = ''final_checking'', final_checking_at = now(), final_checked_by = %L where id = %L returning ''1''', tl, bk));
  out := pg_temp.act(tl, format('select public.send_queue_ticket_to_payment(%L::uuid)::text', bk));
  if out like 'ok:%' then ho := (substr(out, 4)::jsonb ->> 'handoff_id')::uuid; end if;
  if ho is null then raise exception 'PROBE stopped: send to payment %', out; end if;

  -- One statement per case: a read in the same statement as a call sees the pre-call snapshot.
  got := got || jsonb_build_object('car_at_counter', (select status::text from public.bookings where id = bk));
  got := got || jsonb_build_object('other_branch_ba_cannot_complete_payment', pg_temp.act(other_ba, format('select public.complete_payment(%L::uuid, ''cash'')::text', bk)));
  got := got || jsonb_build_object('ba_cannot_complete_payment', pg_temp.act(ba, format('select public.complete_payment(%L::uuid, ''cash'')::text', bk)));
  got := got || jsonb_build_object('car_still_at_counter', (select status::text from public.bookings where id = bk));
  got := got || jsonb_build_object('customer_cannot_write_ops_lab_audit', pg_temp.act(cust, 'select public.ops_lab_write_audit(''probe'', ''probe'', null, ''probe'')::text'));
  got := got || jsonb_build_object('customer_cannot_list_ops_lab_recipients', pg_temp.act(cust, 'select cardinality(public.resolve_ops_lab_notify_user_ids())::text'));

  -- Control: the sanctioned checkout still closes the same car, with a sale.
  out := pg_temp.act(ba, format(
    'select public.complete_pos_sale(%L::jsonb) ->> ''sale_id''', jsonb_build_object(
      'branch','bacoor','customer_id',null,'booking_id',bk,'pos_handoff_id',ho,'payment_method','cash','payment_ref',null,
      'discount_reason',null,'discount_minor',0,'status','paid','notes',null,
      'lines', jsonb_build_array(jsonb_build_object('item_type','service','service_id',svc,'product_id',null,'name','Carwash',
        'quantity',1,'unit_price_minor',price,'is_loyalty_award',false,'is_birthday_award',false,
        'is_membership_included',false,'vehicle_size','medium')))));
  got := got
    || jsonb_build_object('ba_rings_sale_at_pos', case when out like 'ok:%' and out <> 'ok:null' then 'ok' else out end)
    || jsonb_build_object('car_completed_with_sale', (select b.status::text || ':' || count(s.id) from public.bookings b
         left join public.sales s on s.booking_id = b.id and s.status = 'paid' where b.id = bk group by b.status));

  want := jsonb_build_object(
    'car_at_counter',                          'for_payment',
    'other_branch_ba_cannot_complete_payment', 'err',
    'ba_cannot_complete_payment',              'err',
    'car_still_at_counter',                    'for_payment',
    'customer_cannot_write_ops_lab_audit',     'err',
    'customer_cannot_list_ops_lab_recipients', 'err',
    'ba_rings_sale_at_pos',                    'ok',
    'car_completed_with_sale',                 'completed:1');

  for k, w in select key, value #>> '{}' from jsonb_each(want) loop
    v := coalesce(got ->> k, 'missing');
    if (w = 'err' and v like 'err:42501%') or v = w then pass := pass + 1;
    else fail := fail + 1; res := res || jsonb_build_object(k, jsonb_build_object('got', v, 'want', w));
    end if;
  end loop;

  raise exception 'LEGACY_RPC_PROBE %', jsonb_build_object('pass', pass, 'fail', fail, 'failures', res, 'cases', got)::text;
end $$;
