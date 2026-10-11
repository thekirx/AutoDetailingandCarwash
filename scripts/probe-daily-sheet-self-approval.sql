-- BUG-085 probe: can a reviewer approve a Daily Sheet they submitted?
-- Puts one existing sheet into 'submitted' with a chosen submitter, calls
-- review_daily_sheet as a chosen reviewer, and rolls the case back. Always ends
-- in `raise exception`; read the JSON in the message ({"pass","fail","cases"}).

create or replace function pg_temp.review_as(p_sheet uuid, p_submitter uuid, p_caller uuid, p_action text) returns text
language plpgsql as $f$
declare out jsonb;
begin
  update public.daily_sheets set status = 'submitted', submitted_by = p_submitter where id = p_sheet;
  perform set_config('request.jwt.claims', json_build_object('sub', p_caller, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_caller::text, true);
  execute 'set local role authenticated';
  out := public.review_daily_sheet(jsonb_build_object('id', p_sheet, 'action', p_action, 'review_note', 'probe note'));
  raise exception using errcode = 'P0099', message = 'ok:' || (out ->> 'status');
exception
  when sqlstate 'P0099' then return sqlerrm;
  when others then return 'err:' || sqlstate;
end $f$;

do $$
declare
  sa uuid; asa uuid; ba uuid; sheet uuid;
  got jsonb; want jsonb; k text; w text; v text;
  pass int := 0; fail int := 0; res jsonb := '{}';
begin
  select id into sa  from public.staff_profiles where role::text = 'BossMich' and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into asa from public.staff_profiles where role::text = 'assistant_super_admin' and coalesce(is_active,false) and not coalesce(is_archived,false) and coalesce((permission_grants->>'finance_view')::boolean,true) order by created_at limit 1;
  select id into ba  from public.staff_profiles where role::text = 'admin' and coalesce(is_active,false) and not coalesce(is_archived,false) order by created_at limit 1;
  select id into sheet from public.daily_sheets order by business_date desc limit 1;
  if sa is null or asa is null or ba is null or sheet is null then
    raise exception 'PROBE fixtures missing';
  end if;

  got := jsonb_build_object(
    'asa_approves_own_sheet',     pg_temp.review_as(sheet, asa, asa, 'approve'),
    'asa_approves_ba_sheet',      pg_temp.review_as(sheet, ba,  asa, 'approve'),
    'asa_returns_own_sheet',      pg_temp.review_as(sheet, asa, asa, 'return'),
    'super_admin_approves_own',   pg_temp.review_as(sheet, sa,  sa,  'approve'));
  want := jsonb_build_object(
    'asa_approves_own_sheet',     'err:42501',
    'asa_approves_ba_sheet',      'ok:approved',
    'asa_returns_own_sheet',      'ok:returned',
    'super_admin_approves_own',   'ok:approved');

  for k, w in select key, value #>> '{}' from jsonb_each(want) loop
    v := got ->> k;
    if v = w then pass := pass + 1; res := res || jsonb_build_object(k, 'PASS ' || v);
    else fail := fail + 1; res := res || jsonb_build_object(k, 'FAIL got ' || coalesce(v, 'null') || ' want ' || w);
    end if;
  end loop;
  raise exception 'SOD_PROBE %', jsonb_build_object('pass', pass, 'fail', fail, 'cases', res);
end $$;
