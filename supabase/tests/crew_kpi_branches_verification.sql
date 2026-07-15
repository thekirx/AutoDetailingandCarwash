begin;

-- This file is intentionally safe to run against production: every fixture and
-- every mutation is enclosed in this transaction and the file always rolls back.

do $verify_catalog$
declare
  missing text[] := array[]::text[];
begin
  if to_regprocedure('public.sync_queue_assignments(uuid,uuid[])') is null then
    missing := array_append(missing, 'sync_queue_assignments(uuid,uuid[])');
  end if;
  if to_regprocedure('public.send_queue_ticket_to_payment(uuid)') is null then
    missing := array_append(missing, 'send_queue_ticket_to_payment(uuid)');
  end if;
  if to_regprocedure('public.get_crew_kpi(date,date,text)') is null then
    missing := array_append(missing, 'get_crew_kpi(date,date,text)');
  end if;
  if to_regprocedure('public.get_branch_throughput(date,date,text)') is null then
    missing := array_append(missing, 'get_branch_throughput(date,date,text)');
  end if;
  if to_regprocedure('public.create_branch(text,text,text,text)') is null then
    missing := array_append(missing, 'create_branch(text,text,text,text)');
  end if;
  if to_regprocedure('public.update_branch(text,text,text,text,boolean)') is null then
    missing := array_append(missing, 'update_branch(text,text,text,text,boolean)');
  end if;
  if to_regprocedure('public.archive_branch(text)') is null then
    missing := array_append(missing, 'archive_branch(text)');
  end if;
  if to_regprocedure('public.reactivate_branch(text)') is null then
    missing := array_append(missing, 'reactivate_branch(text)');
  end if;
  if to_regprocedure('public.current_user_branch()') is null then
    missing := array_append(missing, 'current_user_branch()');
  end if;

  if cardinality(missing) > 0 then
    raise exception 'VERIFY: missing required functions: %', array_to_string(missing, ', ');
  end if;

  if exists (
    select 1
    from (values
      ('cancelled_at'),
      ('cancelled_by'),
      ('cancellation_reason')
    ) expected(column_name)
    where not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'queue_assignments'
        and c.column_name = expected.column_name
    )
  ) then
    raise exception 'VERIFY: queue assignment cancellation columns are incomplete';
  end if;

  if exists (
    select 1
    from (values
      ('code'),
      ('is_archived'),
      ('archived_at'),
      ('created_by'),
      ('updated_by')
    ) expected(column_name)
    where not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'branches'
        and c.column_name = expected.column_name
    )
  ) then
    raise exception 'VERIFY: branch management columns are incomplete';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'queue_assignments'
      and indexdef ilike 'create unique index%booking_id, staff_id%where%status = ''active''%'
  ) then
    raise exception 'VERIFY: active assignment partial unique index is missing';
  end if;

  if exists (
    select 1
    from pg_views v
    join pg_class c on c.relname = v.viewname
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = v.schemaname
    where v.schemaname = 'public'
      and v.viewname in ('public_queue_counts', 'public_queue_numbers')
      and not coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
  ) then
    raise exception 'VERIFY: public queue views must use security_invoker';
  end if;

  if exists (
    select 1
    from information_schema.role_routine_grants
    where specific_schema = 'public'
      and routine_name in (
        'sync_queue_assignments', 'send_queue_ticket_to_payment',
        'get_crew_kpi', 'get_branch_throughput', 'create_branch',
        'update_branch', 'archive_branch', 'reactivate_branch',
        'complete_payment'
      )
      and grantee in ('PUBLIC', 'anon')
  ) then
    raise exception 'VERIFY: a privileged RPC is executable by public or anon';
  end if;
end
$verify_catalog$;

create temporary table verify_context (
  key text primary key,
  uuid_value uuid,
  text_value text,
  timestamptz_value timestamptz,
  bigint_value bigint
) on commit drop;

grant select, insert, update on verify_context to authenticated;

insert into verify_context (key, uuid_value, text_value)
select 'caller', sp.id, sp.branch_slug
from public.staff_profiles sp
join auth.users u on u.id = sp.id
where sp.role = 'team_lead'
  and coalesce(sp.is_active, true)
  and not coalesce(sp.is_archived, false)
order by sp.created_at
limit 1;

do $verify_fixture_prerequisite$
begin
  if not exists (select 1 from verify_context where key = 'caller') then
    raise exception 'VERIFY: no active auth-backed team lead exists for rollback identity tests';
  end if;
end
$verify_fixture_prerequisite$;

insert into verify_context (key, uuid_value) values
  ('staff_alex', gen_random_uuid()),
  ('staff_ben', gen_random_uuid()),
  ('staff_carlo', gen_random_uuid()),
  ('staff_late', gen_random_uuid()),
  ('customer', gen_random_uuid()),
  ('booking_main', gen_random_uuid()),
  ('booking_cancel', gen_random_uuid()),
  ('booking_cross_branch', gen_random_uuid()),
  ('booking_boundary_1', gen_random_uuid()),
  ('booking_boundary_2', gen_random_uuid()),
  ('booking_boundary_before', gen_random_uuid()),
  ('booking_boundary_after', gen_random_uuid());

insert into verify_context (key, uuid_value)
select 'service', id
from public.services
where coalesce(is_archived, false) = false
order by created_at
limit 1;

do $verify_service$
begin
  if (select uuid_value from verify_context where key = 'service') is null then
    raise exception 'VERIFY: no active service exists for rollback booking fixtures';
  end if;
end
$verify_service$;

insert into public.customers (id, role, full_name, phone, is_archived)
values (
  (select uuid_value from verify_context where key = 'customer'),
  'customer',
  'Rollback KPI Customer',
  '0000000000',
  false
);

insert into public.customers (id, role, full_name, phone, is_archived)
values (
  (select uuid_value from verify_context where key = 'caller'),
  'team_lead',
  'Rollback Team Lead',
  '0000000001',
  false
)
on conflict (id) do nothing;

insert into public.staff_profiles (id, full_name, role, branch_slug, is_active, is_archived)
values
  ((select uuid_value from verify_context where key = 'staff_alex'), 'Rollback Alex', 'staff', (select text_value from verify_context where key = 'caller'), true, false),
  ((select uuid_value from verify_context where key = 'staff_ben'), 'Rollback Ben', 'staff', (select text_value from verify_context where key = 'caller'), true, false),
  ((select uuid_value from verify_context where key = 'staff_carlo'), 'Rollback Carlo', 'staff', (select text_value from verify_context where key = 'caller'), true, false),
  ((select uuid_value from verify_context where key = 'staff_late'), 'Rollback Late Crew', 'staff', (select text_value from verify_context where key = 'caller'), true, false);

insert into public.bookings (
  id, customer_id, service_id, customer_name, customer_phone,
  vehicle_make, vehicle_model, scheduled_start, status, branch,
  queue_date, price_minor, final_price_minor, is_archived
)
values
  (
    (select uuid_value from verify_context where key = 'booking_main'),
    (select uuid_value from verify_context where key = 'customer'),
    (select uuid_value from verify_context where key = 'service'),
    'Rollback Main Customer', '0000000000', 'Test', 'Main', now(),
    'waiting', (select text_value from verify_context where key = 'caller'),
    (now() at time zone 'Asia/Manila')::date, 10000, 10000, false
  ),
  (
    (select uuid_value from verify_context where key = 'booking_cancel'),
    (select uuid_value from verify_context where key = 'customer'),
    (select uuid_value from verify_context where key = 'service'),
    'Rollback Cancel Customer', '0000000000', 'Test', 'Cancel', now(),
    'waiting', (select text_value from verify_context where key = 'caller'),
    (now() at time zone 'Asia/Manila')::date, 10000, 10000, false
  );

select set_config(
  'request.jwt.claim.sub',
  (select uuid_value::text from verify_context where key = 'caller'),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $verify_identity$
declare
  expected_id uuid := (select uuid_value from verify_context where key = 'caller');
  expected_branch text := (select text_value from verify_context where key = 'caller');
begin
  if (select auth.uid()) is distinct from expected_id then
    raise exception 'VERIFY: auth.uid() did not resolve the simulated identity';
  end if;
  if public.current_user_role() is distinct from 'team_lead' then
    raise exception 'VERIFY: current_user_role() did not resolve team_lead';
  end if;
  if public.current_user_branch() is distinct from expected_branch then
    raise exception 'VERIFY: current_user_branch() did not resolve the team lead branch';
  end if;
end
$verify_identity$;

select count(*)
from public.sync_queue_assignments(
  (select uuid_value from verify_context where key = 'booking_main'),
  array[(select uuid_value from verify_context where key = 'staff_alex')]
);

do $verify_one_assignment$
begin
  if (
    select count(*)
    from public.queue_assignments
    where booking_id = (select uuid_value from verify_context where key = 'booking_main')
      and status = 'active'
  ) <> 1 then
    raise exception 'VERIFY: one selected crew did not create one active assignment';
  end if;
end
$verify_one_assignment$;

select count(*)
from public.sync_queue_assignments(
  (select uuid_value from verify_context where key = 'booking_main'),
  array[
    (select uuid_value from verify_context where key = 'staff_alex'),
    (select uuid_value from verify_context where key = 'staff_ben'),
    (select uuid_value from verify_context where key = 'staff_carlo'),
    (select uuid_value from verify_context where key = 'staff_carlo')
  ]
);

insert into verify_context (key, bigint_value)
select 'main_assignment_rows_after_three', count(*)
from public.queue_assignments
where booking_id = (select uuid_value from verify_context where key = 'booking_main');

select count(*)
from public.sync_queue_assignments(
  (select uuid_value from verify_context where key = 'booking_main'),
  array[
    (select uuid_value from verify_context where key = 'staff_carlo'),
    (select uuid_value from verify_context where key = 'staff_alex'),
    (select uuid_value from verify_context where key = 'staff_ben')
  ]
);

do $verify_three_and_retry$
begin
  if (
    select count(*)
    from public.queue_assignments
    where booking_id = (select uuid_value from verify_context where key = 'booking_main')
      and status = 'active'
  ) <> 3 then
    raise exception 'VERIFY: three distinct crew did not produce three active assignments';
  end if;
  if (
    select count(*)
    from public.queue_assignments
    where booking_id = (select uuid_value from verify_context where key = 'booking_main')
  ) <> (select bigint_value from verify_context where key = 'main_assignment_rows_after_three') then
    raise exception 'VERIFY: repeated assignment synchronization created history rows';
  end if;
end
$verify_three_and_retry$;

update public.bookings
set status = 'in_progress'
where id = (select uuid_value from verify_context where key = 'booking_main');

do $verify_started_together$
begin
  if exists (
    select 1
    from public.queue_assignments
    where booking_id = (select uuid_value from verify_context where key = 'booking_main')
      and status = 'active'
      and started_at is null
  ) then
    raise exception 'VERIFY: in_progress transition did not start every active assignment';
  end if;
end
$verify_started_together$;

reset role;
insert into verify_context (key, timestamptz_value)
select 'alex_original_start', started_at
from public.queue_assignments
where booking_id = (select uuid_value from verify_context where key = 'booking_main')
  and staff_id = (select uuid_value from verify_context where key = 'staff_alex');

select pg_sleep(0.01);

set local role authenticated;
select count(*)
from public.sync_queue_assignments(
  (select uuid_value from verify_context where key = 'booking_main'),
  array[
    (select uuid_value from verify_context where key = 'staff_alex'),
    (select uuid_value from verify_context where key = 'staff_ben'),
    (select uuid_value from verify_context where key = 'staff_carlo'),
    (select uuid_value from verify_context where key = 'staff_late')
  ]
);

do $verify_late_start$
begin
  if (
    select started_at
    from public.queue_assignments
    where booking_id = (select uuid_value from verify_context where key = 'booking_main')
      and staff_id = (select uuid_value from verify_context where key = 'staff_alex')
  ) is distinct from (select timestamptz_value from verify_context where key = 'alex_original_start') then
    raise exception 'VERIFY: late crew addition reset an existing start timestamp';
  end if;
  if (
    select started_at
    from public.queue_assignments
    where booking_id = (select uuid_value from verify_context where key = 'booking_main')
      and staff_id = (select uuid_value from verify_context where key = 'staff_late')
  ) <= (select timestamptz_value from verify_context where key = 'alex_original_start') then
    raise exception 'VERIFY: late crew did not receive a later individual start';
  end if;
end
$verify_late_start$;

select count(*)
from public.sync_queue_assignments(
  (select uuid_value from verify_context where key = 'booking_cancel'),
  array[
    (select uuid_value from verify_context where key = 'staff_alex'),
    (select uuid_value from verify_context where key = 'staff_ben'),
    (select uuid_value from verify_context where key = 'staff_carlo')
  ]
);

select count(*)
from public.sync_queue_assignments(
  (select uuid_value from verify_context where key = 'booking_cancel'),
  array[
    (select uuid_value from verify_context where key = 'staff_alex'),
    (select uuid_value from verify_context where key = 'staff_carlo')
  ]
);

do $verify_cancellation$
begin
  if not exists (
    select 1
    from public.queue_assignments
    where booking_id = (select uuid_value from verify_context where key = 'booking_cancel')
      and staff_id = (select uuid_value from verify_context where key = 'staff_ben')
      and status = 'cancelled'
      and cancelled_at is not null
      and cancelled_by = (select uuid_value from verify_context where key = 'caller')
      and cancellation_reason is not null
  ) then
    raise exception 'VERIFY: deselected assignment was not audit-cancelled';
  end if;
end
$verify_cancellation$;

reset role;
update public.queue_assignments
set started_at = case staff_id
  when (select uuid_value from verify_context where key = 'staff_alex') then clock_timestamp() - interval '60 minutes'
  when (select uuid_value from verify_context where key = 'staff_ben') then clock_timestamp() - interval '40 minutes'
  when (select uuid_value from verify_context where key = 'staff_carlo') then clock_timestamp() - interval '20 minutes'
  else started_at
end
where booking_id = (select uuid_value from verify_context where key = 'booking_main')
  and staff_id in (
    (select uuid_value from verify_context where key = 'staff_alex'),
    (select uuid_value from verify_context where key = 'staff_ben'),
    (select uuid_value from verify_context where key = 'staff_carlo')
  );

update public.queue_assignments
set status = 'cancelled',
    cancelled_at = clock_timestamp(),
    cancelled_by = (select uuid_value from verify_context where key = 'caller'),
    cancellation_reason = 'Rollback late crew cancellation'
where booking_id = (select uuid_value from verify_context where key = 'booking_main')
  and staff_id = (select uuid_value from verify_context where key = 'staff_late');

set local role authenticated;
update public.bookings
set status = 'final_checking'
where id = (select uuid_value from verify_context where key = 'booking_main');

insert into verify_context (key, bigint_value)
select 'throughput_before_handoff', completed_vehicle_count
from public.get_branch_throughput(
  (now() at time zone 'Asia/Manila')::date,
  (now() at time zone 'Asia/Manila')::date,
  (select text_value from verify_context where key = 'caller')
);

insert into verify_context (key, text_value)
select 'first_handoff_result', public.send_queue_ticket_to_payment(
  (select uuid_value from verify_context where key = 'booking_main')
)::text;

reset role;
insert into verify_context (key, uuid_value, timestamptz_value)
select 'handoff_snapshot', id, handed_off_at
from public.pos_handoffs
where booking_id = (select uuid_value from verify_context where key = 'booking_main');

insert into verify_context (key, timestamptz_value)
select 'for_payment_snapshot', for_payment_at
from public.bookings
where id = (select uuid_value from verify_context where key = 'booking_main');

insert into verify_context (key, bigint_value)
select 'event_count_snapshot', count(*)
from public.queue_events
where booking_id = (select uuid_value from verify_context where key = 'booking_main')
  and new_status = 'for_payment';

insert into verify_context (key, text_value)
select 'released_snapshot', jsonb_object_agg(qa.staff_id::text, qa.released_at)::text
from public.queue_assignments qa
where qa.booking_id = (select uuid_value from verify_context where key = 'booking_main')
  and qa.status = 'released';

set local role authenticated;
insert into verify_context (key, text_value)
select 'second_handoff_result', public.send_queue_ticket_to_payment(
  (select uuid_value from verify_context where key = 'booking_main')
)::text;

do $verify_handoff_retry$
declare
  first_result jsonb := (select text_value::jsonb from verify_context where key = 'first_handoff_result');
  second_result jsonb := (select text_value::jsonb from verify_context where key = 'second_handoff_result');
begin
  if (first_result ->> 'released_assignment_count')::integer <> 3 then
    raise exception 'VERIFY: initial handoff did not release three active crew';
  end if;
  if not (first_result ->> 'handoff_created')::boolean then
    raise exception 'VERIFY: initial handoff was not reported as created';
  end if;
  if (second_result ->> 'released_assignment_count')::integer <> 0 then
    raise exception 'VERIFY: handoff retry released assignments again';
  end if;
  if (second_result ->> 'handoff_created')::boolean then
    raise exception 'VERIFY: handoff retry was incorrectly reported as created';
  end if;
end
$verify_handoff_retry$;

reset role;
do $verify_preserved_retry_timestamps$
begin
  if (
    select handed_off_at
    from public.pos_handoffs
    where booking_id = (select uuid_value from verify_context where key = 'booking_main')
  ) is distinct from (select timestamptz_value from verify_context where key = 'handoff_snapshot') then
    raise exception 'VERIFY: handoff retry changed handed_off_at';
  end if;
  if (
    select for_payment_at
    from public.bookings
    where id = (select uuid_value from verify_context where key = 'booking_main')
  ) is distinct from (select timestamptz_value from verify_context where key = 'for_payment_snapshot') then
    raise exception 'VERIFY: handoff retry changed for_payment_at';
  end if;
  if (
    select count(*)
    from public.queue_events
    where booking_id = (select uuid_value from verify_context where key = 'booking_main')
      and new_status = 'for_payment'
  ) <> (select bigint_value from verify_context where key = 'event_count_snapshot') then
    raise exception 'VERIFY: handoff retry created another operational event';
  end if;
  if exists (
    select 1
    from public.queue_assignments
    where booking_id = (select uuid_value from verify_context where key = 'booking_main')
      and staff_id in (
        (select uuid_value from verify_context where key = 'staff_alex'),
        (select uuid_value from verify_context where key = 'staff_ben'),
        (select uuid_value from verify_context where key = 'staff_carlo')
      )
      and (status <> 'released' or released_at is null or completed_at is null)
  ) then
    raise exception 'VERIFY: handoff did not leave all active crew released with end timestamps';
  end if;
  if (
    select jsonb_object_agg(qa.staff_id::text, qa.released_at)
    from public.queue_assignments qa
    where qa.booking_id = (select uuid_value from verify_context where key = 'booking_main')
      and qa.status = 'released'
  ) is distinct from (
    select text_value::jsonb from verify_context where key = 'released_snapshot'
  ) then
    raise exception 'VERIFY: handoff retry changed an assignment released_at timestamp';
  end if;
end
$verify_preserved_retry_timestamps$;

set local role authenticated;
do $verify_kpi_and_throughput$
declare
  report_date date := (now() at time zone 'Asia/Manila')::date;
  kpi_rows integer;
  handled_sum bigint;
  distinct_duration_count integer;
  throughput bigint;
begin
  select count(*), sum(cars_handled), count(distinct completed_deployed_seconds)
  into kpi_rows, handled_sum, distinct_duration_count
  from public.get_crew_kpi(report_date, report_date, (select text_value from verify_context where key = 'caller'))
  where staff_id in (
    (select uuid_value from verify_context where key = 'staff_alex'),
    (select uuid_value from verify_context where key = 'staff_ben'),
    (select uuid_value from verify_context where key = 'staff_carlo')
  );

  if kpi_rows <> 3 or handled_sum <> 3 then
    raise exception 'VERIFY: three crew did not each receive one full KPI credit';
  end if;
  if distinct_duration_count <> 3 then
    raise exception 'VERIFY: crew deployed durations were not calculated individually';
  end if;

  select completed_vehicle_count
  into throughput
  from public.get_branch_throughput(report_date, report_date, (select text_value from verify_context where key = 'caller'));

  if throughput <> (select bigint_value + 1 from verify_context where key = 'throughput_before_handoff') then
    raise exception 'VERIFY: one multi-crew car did not increase branch completion by exactly one';
  end if;

  if exists (
    select 1
    from public.get_crew_kpi(report_date, report_date, (select text_value from verify_context where key = 'caller'))
    where staff_id = (select uuid_value from verify_context where key = 'staff_late')
      and cars_handled <> 0
  ) then
    raise exception 'VERIFY: cancelled late crew received completed credit';
  end if;
end
$verify_kpi_and_throughput$;

reset role;
update public.staff_profiles
set role = 'admin'
where id = (select uuid_value from verify_context where key = 'caller');
set local role authenticated;

do $verify_admin_identity$
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'VERIFY: simulated admin role did not resolve';
  end if;
  if not public.is_admin() then
    raise exception 'VERIFY: is_admin() rejected an admin';
  end if;
end
$verify_admin_identity$;

select public.create_branch('Rollback Third Branch', 'ROLLBACK-THIRD', 'rbt', 'Rollback Address');
select public.update_branch('rollback-third', 'Rollback Renamed Branch', 'RBX', 'Updated Address', true);

reset role;
insert into public.bookings (
  id, customer_id, service_id, customer_name, customer_phone,
  vehicle_make, vehicle_model, scheduled_start, status, branch,
  queue_date, price_minor, final_price_minor, is_archived
)
values (
  (select uuid_value from verify_context where key = 'booking_cross_branch'),
  (select uuid_value from verify_context where key = 'customer'),
  (select uuid_value from verify_context where key = 'service'),
  'Rollback Cross Branch', '0000000000', 'Test', 'Cross', now(),
  'waiting', 'rollback-third', (now() at time zone 'Asia/Manila')::date,
  10000, 10000, false
);

update public.staff_profiles
set role = 'team_lead'
where id = (select uuid_value from verify_context where key = 'caller');
set local role authenticated;

do $verify_cross_branch_denial$
declare
  denied boolean := false;
  row_count integer;
begin
  if public.current_user_role() is distinct from 'team_lead' then
    raise exception 'VERIFY: simulated team lead role did not resolve after reset';
  end if;
  begin
    select count(*) into row_count
    from public.sync_queue_assignments(
      (select uuid_value from verify_context where key = 'booking_cross_branch'),
      array[(select uuid_value from verify_context where key = 'staff_alex')]
    );
  exception
    when insufficient_privilege then denied := true;
  end;
  if not denied then
    raise exception 'VERIFY: team lead could synchronize another branch';
  end if;
end
$verify_cross_branch_denial$;

reset role;
update public.staff_profiles
set role = 'BossMich'
where id = (select uuid_value from verify_context where key = 'caller');
set local role authenticated;

do $verify_boss_identity$
begin
  if public.current_user_role() is distinct from 'BossMich' then
    raise exception 'VERIFY: simulated BossMich role did not resolve';
  end if;
  if not public.is_admin() then
    raise exception 'VERIFY: is_admin() rejected BossMich';
  end if;
end
$verify_boss_identity$;

do $verify_archive_guard$
declare
  denied boolean := false;
begin
  begin
    perform public.archive_branch('rollback-third');
  exception
    when object_in_use then denied := true;
  end;
  if not denied then
    raise exception 'VERIFY: branch archival did not reject an active booking';
  end if;
end
$verify_archive_guard$;

reset role;
update public.bookings
set status = 'cancelled', cancelled_at = now()
where id = (select uuid_value from verify_context where key = 'booking_cross_branch');
set local role authenticated;
select public.archive_branch('rollback-third');
select public.reactivate_branch('rollback-third');

reset role;
insert into public.bookings (
  id, customer_id, service_id, customer_name, customer_phone,
  vehicle_make, vehicle_model, scheduled_start, status, branch,
  queue_date, price_minor, final_price_minor, is_archived,
  for_payment_at, completed_at
)
values
  (
    (select uuid_value from verify_context where key = 'booking_boundary_1'),
    (select uuid_value from verify_context where key = 'customer'),
    (select uuid_value from verify_context where key = 'service'),
    'Boundary 1', '0000000000', 'Test', 'Boundary', now(), 'for_payment',
    'rollback-third', date '2026-07-15', 10000, 10000, false,
    timestamptz '2026-07-14 16:00:00+00', null
  ),
  (
    (select uuid_value from verify_context where key = 'booking_boundary_2'),
    (select uuid_value from verify_context where key = 'customer'),
    (select uuid_value from verify_context where key = 'service'),
    'Boundary 2', '0000000000', 'Test', 'Boundary', now(), 'completed',
    'rollback-third', date '2026-07-15', 10000, 10000, false,
    null, timestamptz '2026-07-15 15:59:59+00'
  ),
  (
    (select uuid_value from verify_context where key = 'booking_boundary_before'),
    (select uuid_value from verify_context where key = 'customer'),
    (select uuid_value from verify_context where key = 'service'),
    'Boundary Before', '0000000000', 'Test', 'Boundary', now(), 'for_payment',
    'rollback-third', date '2026-07-14', 10000, 10000, false,
    timestamptz '2026-07-14 15:59:59+00', null
  ),
  (
    (select uuid_value from verify_context where key = 'booking_boundary_after'),
    (select uuid_value from verify_context where key = 'customer'),
    (select uuid_value from verify_context where key = 'service'),
    'Boundary After', '0000000000', 'Test', 'Boundary', now(), 'cancelled',
    'rollback-third', date '2026-07-16', 10000, 10000, false,
    timestamptz '2026-07-15 16:00:00+00', null
  );

set local role authenticated;
do $verify_manila_boundaries$
declare
  throughput bigint;
begin
  select completed_vehicle_count
  into throughput
  from public.get_branch_throughput(date '2026-07-15', date '2026-07-15', 'rollback-third');

  if throughput <> 2 then
    raise exception 'VERIFY: Asia/Manila inclusive date boundary expected 2, got %', throughput;
  end if;
end
$verify_manila_boundaries$;

reset role;
do $verify_branch_preservation$
begin
  if not exists (select 1 from public.branches where slug = 'bacoor' and code = 'BAC') then
    raise exception 'VERIFY: Bacoor branch/code was not preserved';
  end if;
  if not exists (select 1 from public.branches where slug = 'batangas' and code = 'BTG') then
    raise exception 'VERIFY: Batangas branch/code was not preserved';
  end if;
  if not exists (
    select 1 from public.branches
    where slug = 'rollback-third'
      and name = 'Rollback Renamed Branch'
      and is_active
      and not is_archived
  ) then
    raise exception 'VERIFY: branch rename/reactivation did not preserve the stable slug';
  end if;
end
$verify_branch_preservation$;

rollback;
