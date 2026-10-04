-- Daily-flow role probe: drives one Batangas car through the real queue lifecycle as each role
-- (TL -> crew -> redo -> BA send to payment -> BA/ASA/SA overrides -> TL cancel), checks cross-branch
-- denials, and BA-vs-reviewer rights on a submitted daily sheet. Everything runs inside one transaction
-- that ends in ROLLBACK: nothing persists. No trigger or RPC here makes HTTP calls; SMS/push are sent by
-- the app server from committed rows only, so the probe cannot message anyone.
begin;

create temp table probe (n serial, step text, ok boolean, detail text) on commit drop;
grant insert, select on probe to authenticated;
grant usage on sequence probe_n_seq to authenticated;

do $$
declare
  tl_bat constant uuid := '618ff5cb-28fd-41ae-a856-88719a5474d9';
  tl_bac constant uuid := '166a62a4-57ab-4ed9-bd38-1752246c119d';
  ba_bat constant uuid := '5798f715-8425-412e-94f9-ac5e7326a736';
  ba_bac constant uuid := '0f9dc99f-7db7-42f8-9e92-d5655cb8cea7';
  asa constant uuid := 'a4c4b11d-84ed-4af2-a2de-1d9f4fd87351';
  sa constant uuid := 'baa49123-3a05-42e1-b9b6-3a51d4d2a76c';
  crew_bat constant uuid := 'bcc24bed-ac6e-442c-b97c-5cfb7c110f12';
  wash constant uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  b1 constant uuid := gen_random_uuid();
  b2 constant uuid := gen_random_uuid();
  cust uuid;
  sheet uuid;
  n int;
  s text;
  who uuid;
  msg text;
begin
  select customer_id into cust from public.bookings where vehicle_plate like 'ZZT%' and customer_id is not null limit 1;
  insert into public.bookings (id, branch, customer_id, service_id, customer_name, customer_phone, vehicle_make, vehicle_model,
                               vehicle_plate, vehicle_type,
                               scheduled_start, queue_date, queue_number, status, notes, team_lead_id, price_minor, final_price_minor, waiting_at)
  select x.id, 'batangas', cust, wash, 'Probe Customer', '09555009999', 'Toyota', 'Vios', x.plate, 'medium', now(),
         (now() at time zone 'Asia/Manila')::date, x.q, 'waiting', '[probe] rolled back', tl_bat, 45000, 45000, now()
  from (values (b1, 'ZZP0001', 999), (b2, 'ZZP0002', 998)) as x(id, plate, q);
  insert into public.staff_attendance (staff_id, branch_slug, attendance_date, status, checked_in_at, marked_by, source)
  values (crew_bat, 'batangas', (now() at time zone 'Asia/Manila')::date, 'present', now(), ba_bat, 'manual') on conflict do nothing;

  -- Team Lead (Batangas): assign crew, start, final check (P0: final_checked_by), redo, restart, final check
  perform set_config('request.jwt.claims', json_build_object('sub', tl_bat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.sync_queue_assignments(b1, array[crew_bat]);
    insert into probe (step, ok, detail) values ('TL assigns crew', true, null);
  exception when others then insert into probe (step, ok, detail) values ('TL assigns crew', false, sqlerrm);
  end;
  update public.bookings set status = 'in_progress', in_progress_at = now(), actual_start = now() where id = b1;
  get diagnostics n = row_count;
  insert into probe (step, ok, detail) values ('TL waiting -> in_progress', n = 1, n || ' row');
  update public.bookings set status = 'final_checking', final_checking_at = now(), final_checked_by = tl_bat where id = b1;
  get diagnostics n = row_count;
  insert into probe (step, ok, detail) values ('TL in_progress -> final_checking (stamps TL)', n = 1, n || ' row');
  update public.bookings set status = 'redo', redo_at = now(), redo_by = tl_bat, redo_reason = 'Water spots on hood' where id = b1;
  get diagnostics n = row_count;
  insert into probe (step, ok, detail) values ('TL final_checking -> redo (failed QA)', n = 1, n || ' row');
  update public.bookings set status = 'in_progress', in_progress_at = now() where id = b1;
  update public.bookings set status = 'final_checking', final_checking_at = now(), final_checked_by = tl_bat where id = b1;
  get diagnostics n = row_count;
  insert into probe (step, ok, detail) values ('TL redo -> in_progress -> final_checking', n = 1, n || ' row');
  begin
    perform public.send_queue_ticket_to_payment(b1);
    insert into probe (step, ok, detail) values ('TL send to payment (TL hands to POS)', true, 'allowed');
  exception when others then insert into probe (step, ok, detail) values ('TL send to payment (TL hands to POS)', false, sqlerrm);
  end;
  select status, sent_to_payment_by into s, who from public.bookings where id = b1;
  insert into probe (step, ok, detail) values ('TL send stamps TL as sender', s = 'for_payment' and who = tl_bat, s || ', by=' || coalesce(left(who::text, 8), 'null'));
  if s = 'for_payment' then
    -- put it back so the BA path below starts from final_checking
    reset role;
    update public.bookings set status = 'final_checking' where id = b1;
    update public.pos_handoffs set status = 'cancelled' where booking_id = b1 and status = 'pending';
  end if;
  reset role;

  -- Cross-branch and crew denials
  perform set_config('request.jwt.claims', json_build_object('sub', tl_bac, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.bookings set status = 'cancelled', cancellation_reason = 'cross-branch' where id = b1;
  get diagnostics n = row_count;
  insert into probe (step, ok, detail) values ('Bacoor TL cannot touch Batangas car', n = 0, n || ' row');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', crew_bat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.bookings set status = 'completed' where id = b1;
    get diagnostics n = row_count;
    insert into probe (step, ok, detail) values ('Crew cannot change car status', n = 0, n || ' row');
  exception when others then insert into probe (step, ok, detail) values ('Crew cannot change car status', true, sqlerrm);
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ba_bac, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.send_queue_ticket_to_payment(b1);
    insert into probe (step, ok, detail) values ('Bacoor BA cannot send Batangas car to payment', false, 'allowed');
  exception when others then insert into probe (step, ok, detail) values ('Bacoor BA cannot send Batangas car to payment', true, sqlerrm);
  end;
  begin
    perform public.admin_override_queue_status(b1, 'waiting', 'cross-branch');
    insert into probe (step, ok, detail) values ('Bacoor BA cannot override Batangas car', false, 'allowed');
  exception when others then insert into probe (step, ok, detail) values ('Bacoor BA cannot override Batangas car', true, sqlerrm);
  end;
  reset role;

  -- Branch Admin (Batangas): send to payment, then override back with a reason
  perform set_config('request.jwt.claims', json_build_object('sub', ba_bat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.send_queue_ticket_to_payment(b1);
    select status into s from public.bookings where id = b1;
    select sent_to_payment_by into who from public.bookings where id = b1;
    select count(*) into n from public.pos_handoffs where booking_id = b1 and status = 'pending';
    -- sent_to_payment_by keeps the first sender (the TL above); a re-send never overwrites it
    insert into probe (step, ok, detail) values ('BA re-send to payment (POS handoff, first sender kept)', s = 'for_payment' and who = tl_bat and n = 1,
      s || ', by=' || coalesce(left(who::text, 8), 'null') || ', pending handoffs=' || n);
  exception when others then insert into probe (step, ok, detail) values ('BA re-send to payment (POS handoff, first sender kept)', false, sqlerrm);
  end;
  begin
    perform public.admin_override_queue_status(b1, 'final_checking', 'Customer asked for a re-check');
    select status into s from public.bookings where id = b1;
    select count(*) into n from public.pos_handoffs where booking_id = b1 and status = 'pending';
    insert into probe (step, ok, detail) values ('BA override for_payment -> final_checking (handoff cancelled)', s = 'final_checking' and n = 0, s || ', pending handoffs=' || n);
  exception when others then insert into probe (step, ok, detail) values ('BA override for_payment -> final_checking (handoff cancelled)', false, sqlerrm);
  end;
  reset role;

  -- ASA and SA overrides
  perform set_config('request.jwt.claims', json_build_object('sub', asa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_override_queue_status(b1, 'in_progress', 'ASA: crew missed the tyres');
    select status into s from public.bookings where id = b1;
    insert into probe (step, ok, detail) values ('ASA override final_checking -> in_progress', s = 'in_progress', s);
  exception when others then insert into probe (step, ok, detail) values ('ASA override final_checking -> in_progress', false, sqlerrm);
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.admin_override_queue_status(b1, 'waiting', 'SA: customer stepped out, re-queue');
    select status into s from public.bookings where id = b1;
    insert into probe (step, ok, detail) values ('SA override in_progress -> waiting', s = 'waiting', s);
  exception when others then insert into probe (step, ok, detail) values ('SA override in_progress -> waiting', false, sqlerrm);
  end;
  reset role;

  -- Team Lead cancels the second car with a reason
  perform set_config('request.jwt.claims', json_build_object('sub', tl_bat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Customer left before service' where id = b2;
  get diagnostics n = row_count;
  insert into probe (step, ok, detail) values ('TL cancels waiting car with reason', n = 1, n || ' row');
  reset role;

  -- Audit trail: every move logged with its actor; no completion => no SMS queued
  select count(*) into n from public.queue_events where booking_id = b1 and changed_by is not null;
  select string_agg(old_status || '>' || new_status, ' ' order by created_at, id) into msg from public.queue_events where booking_id = b1;
  insert into probe (step, ok, detail) values ('queue_events logged with actor', n >= 9, n || ': ' || coalesce(msg, ''));
  select count(*) into n from public.sms_events where booking_id in (b1, b2);
  insert into probe (step, ok, detail) values ('No SMS queued for non-completed cars', n = 0, n || ' sms_events');

  -- Daily sheet: BA cannot approve its own submitted sheet; ASA can (approval rolled back)
  select id into sheet from public.daily_sheets where branch = 'batangas' and business_date = '2026-09-30' and status = 'submitted';
  perform set_config('request.jwt.claims', json_build_object('sub', ba_bat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.review_daily_sheet(jsonb_build_object('id', sheet, 'action', 'approve', 'review_note', null));
    insert into probe (step, ok, detail) values ('BA cannot approve own daily sheet', false, 'allowed');
  exception when others then insert into probe (step, ok, detail) values ('BA cannot approve own daily sheet', true, sqlerrm);
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', asa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.review_daily_sheet(jsonb_build_object('id', sheet, 'action', 'approve', 'review_note', 'Probe approval'));
    select status into s from public.daily_sheets where id = sheet;
    insert into probe (step, ok, detail) values ('ASA approves submitted daily sheet', s = 'approved', s);
  exception when others then insert into probe (step, ok, detail) values ('ASA approves submitted daily sheet', false, sqlerrm);
  end;
  reset role;
end $$;

select n, case when ok then 'PASS' else 'FAIL' end as result, step, detail from probe order by n;
rollback;
