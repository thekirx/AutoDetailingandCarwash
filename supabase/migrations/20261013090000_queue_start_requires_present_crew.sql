-- A queue ticket could be started with nobody on it.
--
-- updateTicketStatus (src/queue/queueApi.js) refuses to move a ticket to
-- in_progress until it has an active crew assignment, but that check runs in the
-- browser. The update itself is a plain PostgREST write on public.bookings, so a
-- Team Lead session could start a wash with no crew. Nobody is then credited for
-- the wash, and the floor board shows work that no one on the floor is doing.
-- Found by scripts/probe-shop-day-lifecycle.sql (tl_cannot_start_without_crew).
--
-- The rule matches the app's, plus attendance:
--
--   * Crew is required unless the service is a package (package, ppf), the same
--     split as crewRequiredForPayCategory in src/queue/queueLogic.js.
--   * The crew must be present (or late) on today's Manila attendance.
--     sync_queue_assignments already refuses absent crew at assignment time; this
--     also catches crew assigned on an earlier day.
--   * Any line of the same visit counts. Multi-service visits move every line in
--     one update while crew sits on the primary line only.
--
-- It fires only for direct client writes (current_user = 'authenticated').
-- Server paths run as their definer or as service_role and are untouched:
-- admin_override_queue_status (Branch Admin pulls a paid-pending ticket back after
-- its crew was released) and /api/booking-status (Bookings board, where Sales
-- starts detailing jobs without crew by design).
--
-- Guard: aborts if any column the rule reads is missing, so a renamed column
-- fails here instead of refusing (or waving through) every start on the floor.

begin;

do $$
declare v_missing text;
begin
  select string_agg(req.t || '.' || req.c, ', ') into v_missing
  from (values
    ('queue_assignments', 'booking_id'), ('queue_assignments', 'staff_id'), ('queue_assignments', 'status'),
    ('staff_attendance', 'staff_id'), ('staff_attendance', 'attendance_date'), ('staff_attendance', 'status'),
    ('bookings', 'visit_group_id'), ('bookings', 'service_id'), ('services', 'pay_category')
  ) req(t, c)
  where not exists (
    select 1 from information_schema.columns ic
    where ic.table_schema = 'public' and ic.table_name = req.t and ic.column_name = req.c
  );
  if v_missing is not null then
    raise exception 'crew-on-start rule reads columns that are missing: %', v_missing;
  end if;
end $$;

-- Definer, so the answer never depends on what the caller's RLS lets it read.
create or replace function public.visit_has_present_crew(p_booking_id uuid, p_visit_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    join public.staff_attendance sa
      on sa.staff_id = qa.staff_id
     and sa.attendance_date = (timezone('Asia/Manila', now()))::date
     and sa.status in ('present', 'late')
    where qa.status = 'active'
      and (b.id = p_booking_id or (p_visit_group_id is not null and b.visit_group_id = p_visit_group_id))
  );
$$;

revoke all on function public.visit_has_present_crew(uuid, uuid) from public, anon;
grant execute on function public.visit_has_present_crew(uuid, uuid) to authenticated;

-- Invoker, not definer: current_user must be the caller's role. Inside a definer
-- RPC it is the function owner, which is how server paths are told apart.
create or replace function public.require_present_crew_on_start()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_user <> 'authenticated'
     or new.status::text <> 'in_progress'
     or old.status::text = 'in_progress' then
    return new;
  end if;

  if lower(coalesce((select s.pay_category from public.services s where s.id = new.service_id), '')) in ('package', 'ppf') then
    return new;
  end if;

  if not public.visit_has_present_crew(new.id, new.visit_group_id) then
    raise exception using
      errcode = '23514',
      message = 'Assign at least one present crew member before starting service.';
  end if;

  return new;
end;
$$;

revoke all on function public.require_present_crew_on_start() from public, anon, authenticated;

drop trigger if exists trg_require_present_crew_on_start on public.bookings;
create trigger trg_require_present_crew_on_start
  before update of status on public.bookings
  for each row
  execute function public.require_present_crew_on_start();

commit;
