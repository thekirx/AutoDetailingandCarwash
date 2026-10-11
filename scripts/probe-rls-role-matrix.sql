-- Role matrix probe for BUG-069/070/071/079/080 (expenses, customers,
-- transactions, user_notifications, sms_templates).
--
-- Impersonates one active account per role the way PostgREST does (role
-- authenticated + request.jwt.claims), attempts each write, and compares the
-- outcome with the expected value written below. It ALWAYS ends in
-- `raise exception`, so every write it attempted is rolled back. The result
-- JSON is in the error message: {"pass": n, "fail": n, "cases": {...}}.
--
-- Outcomes: 'ok:N' = statement ran and touched/counted N rows (RLS denial on
-- update/delete reads as ok:0), 'err:SQLSTATE' = statement refused
-- (42501 = RLS check on insert). 'ok:>0' is an expectation, not an outcome.
-- Each case is rolled back before the next runs.
--
-- Customer DELETE is not probed: the customers_soft_delete trigger turns every
-- delete into an archive, so row_count is always 0 for every role.

create or replace function pg_temp.probe(p_uid uuid, p_sql text) returns text
language plpgsql as $f$
declare n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
  if p_sql ilike 'select%' then
    execute p_sql into n;
  else
    execute p_sql;
    get diagnostics n = row_count;
  end if;
  -- Undo this case before the next one sees it.
  raise exception using errcode = 'P0099', message = 'ok:' || n;
exception
  when sqlstate 'P0099' then return sqlerrm;
  when others then return 'err:' || sqlstate;
end $f$;

do $$
declare
  sa uuid; asa uuid; ba uuid; mk uuid;
  plain_exp uuid; sheet_exp uuid; cust uuid; tx uuid;
  got jsonb := '{}'; want jsonb; k text; v text; w text;
  pass int := 0; fail int := 0; res jsonb := '{}';
begin
  select id into sa  from public.staff_profiles where role::text = 'BossMich' and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into asa from public.staff_profiles where role::text = 'assistant_super_admin' and coalesce(is_active,false) and not coalesce(is_archived,false) and coalesce((permission_grants->>'finance_write')::boolean,false) and coalesce((permission_grants->>'crm')::boolean,true) order by created_at limit 1;
  select id into ba  from public.staff_profiles where role::text = 'admin' and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into mk  from public.staff_profiles where role::text = 'marketing' and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  if sa is null or asa is null or ba is null or mk is null then
    raise exception 'PROBE fixtures missing: sa=% asa=% ba=% marketing=%', sa, asa, ba, mk;
  end if;

  -- A plain bill in a branch the Branch Admin can see, so a red result is the hole and not branch scoping.
  perform set_config('request.jwt.claims', json_build_object('sub', ba, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ba::text, true);
  select e.id into plain_exp from public.expenses e
   where e.daily_sheet_line_id is null and public.user_has_branch_access(e.branch)
   order by e.created_at desc limit 1;
  select id into sheet_exp from public.expenses where daily_sheet_line_id is not null order by created_at desc limit 1;
  select id into cust from public.customers order by created_at desc limit 1;
  select id into tx from public.transactions order by created_at desc limit 1;

  got := got
    || jsonb_build_object('ba_update_plain_expense',  pg_temp.probe(ba,  format('update public.expenses set updated_at = now() where id = %L', plain_exp)))
    || jsonb_build_object('ba_delete_plain_expense',  pg_temp.probe(ba,  format('delete from public.expenses where id = %L', plain_exp)))
    || jsonb_build_object('sa_update_sheet_expense',  pg_temp.probe(sa,  format('update public.expenses set updated_at = now() where id = %L', sheet_exp)))
    || jsonb_build_object('sa_delete_sheet_expense',  pg_temp.probe(sa,  format('delete from public.expenses where id = %L', sheet_exp)))
    || jsonb_build_object('sa_update_plain_expense',  pg_temp.probe(sa,  format('update public.expenses set updated_at = now() where id = %L', plain_exp)))
    || jsonb_build_object('asa_update_plain_expense', pg_temp.probe(asa, format('update public.expenses set updated_at = now() where id = %L', plain_exp)))
    || jsonb_build_object('asa_delete_plain_expense', pg_temp.probe(asa, format('delete from public.expenses where id = %L', plain_exp)))
    || jsonb_build_object('ba_select_expenses',       pg_temp.probe(ba,  'select count(*) from public.expenses'))
    || jsonb_build_object('ba_update_customer',       pg_temp.probe(ba,  format('update public.customers set updated_at = now() where id = %L', cust)))
    || jsonb_build_object('marketing_update_customer', pg_temp.probe(mk, format('update public.customers set updated_at = now() where id = %L', cust)))
    || jsonb_build_object('ba_insert_transaction',    pg_temp.probe(ba,  'insert into public.transactions (amount_minor, description) values (1, ''rls probe'')'))
    || jsonb_build_object('ba_update_transaction',    pg_temp.probe(ba,  format('update public.transactions set updated_at = now() where id = %L', tx)))
    || jsonb_build_object('ba_select_transactions',   pg_temp.probe(ba,  'select count(*) from public.transactions'))
    || jsonb_build_object('sa_select_transactions',   pg_temp.probe(sa,  'select count(*) from public.transactions'))
    || jsonb_build_object('ba_read_others_notifs',    pg_temp.probe(ba,  'select count(*) from public.user_notifications where user_id <> auth.uid()'))
    || jsonb_build_object('asa_read_others_notifs',   pg_temp.probe(asa, 'select count(*) from public.user_notifications where user_id <> auth.uid()'))
    || jsonb_build_object('sa_read_others_notifs',    pg_temp.probe(sa,  'select count(*) from public.user_notifications where user_id <> auth.uid()'))
    || jsonb_build_object('ba_insert_notif_for_sa',   pg_temp.probe(ba,  format('insert into public.user_notifications (user_id, kind, title, body) values (%L, ''probe'', ''probe'', ''probe'')', sa)))
    || jsonb_build_object('ba_insert_notif_for_self', pg_temp.probe(ba,  format('insert into public.user_notifications (user_id, kind, title, body) values (%L, ''probe'', ''probe'', ''probe'')', ba)))
    || jsonb_build_object('sa_insert_notif_for_ba',   pg_temp.probe(sa,  format('insert into public.user_notifications (user_id, kind, title, body) values (%L, ''probe'', ''probe'', ''probe'')', ba)))
    || jsonb_build_object('ba_insert_sms_template',   pg_temp.probe(ba,  'insert into public.sms_templates (name, template_type, body) values (''probe'', ''promo'', ''probe'')'))
    || jsonb_build_object('asa_insert_sms_template',  pg_temp.probe(asa, 'insert into public.sms_templates (name, template_type, body) values (''probe'', ''promo'', ''probe'')'))
    || jsonb_build_object('marketing_insert_sms_template', pg_temp.probe(mk, 'insert into public.sms_templates (name, template_type, body) values (''probe'', ''promo'', ''probe'')'))
    || jsonb_build_object('sa_insert_sms_template',   pg_temp.probe(sa,  'insert into public.sms_templates (name, template_type, body) values (''probe'', ''promo'', ''probe'')'));

  want := jsonb_build_object(
    'ba_update_plain_expense', 'ok:0',
    'ba_delete_plain_expense', 'ok:0',
    'sa_update_sheet_expense', 'ok:0',
    'sa_delete_sheet_expense', 'ok:0',
    'sa_update_plain_expense', 'ok:1',
    'asa_update_plain_expense', 'ok:1',
    'asa_delete_plain_expense', 'ok:1',
    'ba_select_expenses', 'ok:>0',
    'ba_update_customer', 'ok:1',
    'marketing_update_customer', 'ok:1',
    'ba_insert_transaction', 'err:42501',
    'ba_update_transaction', 'ok:0',
    'ba_select_transactions', 'ok:>0',
    'sa_select_transactions', 'ok:>0',
    'ba_read_others_notifs', 'ok:0',
    'asa_read_others_notifs', 'ok:0',
    'sa_read_others_notifs', 'ok:>0',
    'ba_insert_notif_for_sa', 'err:42501',
    'ba_insert_notif_for_self', 'ok:1',
    'sa_insert_notif_for_ba', 'ok:1',
    'ba_insert_sms_template', 'err:42501',
    'asa_insert_sms_template', 'ok:1',
    'marketing_insert_sms_template', 'ok:1',
    'sa_insert_sms_template', 'ok:1'
  );

  for k, w in select key, value #>> '{}' from jsonb_each(want) loop
    v := got ->> k;
    if (w = 'ok:>0' and v like 'ok:%' and v <> 'ok:0') or v = w then
      pass := pass + 1;
      res := res || jsonb_build_object(k, 'PASS ' || v);
    else
      fail := fail + 1;
      res := res || jsonb_build_object(k, 'FAIL got ' || coalesce(v, 'null') || ' want ' || w);
    end if;
  end loop;

  raise exception 'RLS_PROBE %', jsonb_build_object('pass', pass, 'fail', fail, 'cases', res);
end $$;
