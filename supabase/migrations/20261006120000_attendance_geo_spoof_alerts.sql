-- Spoofed / tampered geo time-in: checked server-side, blocked, logged, and sent to SA / ASA / Branch Admin.
-- A browser cannot read Android Developer options or the OS mock-location flag, so these checks look at what the
-- fix itself gives away: hand-typed or pasted coordinates, replays, missing accuracy, automation, stale fixes.

alter table public.staff_attendance add column if not exists check_in_accuracy_m double precision;

create table if not exists public.attendance_location_alerts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  branch_slug text not null,
  reasons text[] not null,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists attendance_location_alerts_branch_created_idx
  on public.attendance_location_alerts (branch_slug, created_at desc);
create index if not exists attendance_location_alerts_staff_idx
  on public.attendance_location_alerts (staff_id);

alter table public.attendance_location_alerts enable row level security;

drop policy if exists attendance_location_alerts_select on public.attendance_location_alerts;
create policy attendance_location_alerts_select on public.attendance_location_alerts
for select to authenticated
using (
  public.current_user_role() in ('BossMich', 'assistant_super_admin', 'admin')
  and public.user_has_branch_access(branch_slug)
);

revoke insert, update, delete on public.attendance_location_alerts from anon, authenticated;

create or replace function public.geo_clock_in(
  p_branch_slug text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m double precision default null,
  p_client_flags text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  manila timestamp := now() at time zone 'Asia/Manila';
  prof record;
  br record;
  reasons text[] := '{}';
  new_alert uuid;
  is_late boolean;
  saved record;
begin
  if uid is null then
    raise exception 'Sign in to time in';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'Geo clock-in requires coordinates';
  end if;

  select sp.full_name, sp.attendance_enabled, sp.geofence_enabled
  into prof
  from public.staff_profiles sp
  where sp.id = uid and coalesce(sp.is_active, false) and not coalesce(sp.is_archived, false);
  if not found then
    raise exception 'Staff profile not found';
  end if;
  if coalesce(prof.attendance_enabled, true) = false then
    raise exception 'Attendance is turned off for this account.';
  end if;
  if not public.user_has_branch_access(p_branch_slug) then
    raise exception 'You are not assigned to this branch';
  end if;

  select b.name, b.latitude, b.longitude, b.shift_start
  into br
  from public.branches b
  where b.slug = p_branch_slug;
  if not found then
    raise exception 'Branch not found';
  end if;

  if coalesce(prof.geofence_enabled, true) then
    reasons := array(
      select distinct f from unnest(coalesce(p_client_flags, '{}')) f where f in ('automation', 'stale_fix')
    );
    -- Real fixes always carry a positive accuracy radius.
    if p_accuracy_m is null or not (p_accuracy_m > 0) or p_accuracy_m = 'Infinity'::float8 or p_accuracy_m = 'NaN'::float8 then
      reasons := reasons || 'no_accuracy'::text;
    end if;
    -- ponytail: ≤5 decimals on both axes (~1 m) = typed or pasted; device fixes carry 7+. Ceiling: a platform that rounds fixes would false-positive.
    if p_lat::numeric = round(p_lat::numeric, 5) and p_lng::numeric = round(p_lng::numeric, 5) then
      reasons := reasons || 'low_precision'::text;
    end if;
    if br.latitude is not null and abs(p_lat - br.latitude) < 1e-6 and abs(p_lng - br.longitude) < 1e-6 then
      reasons := reasons || 'pin_match'::text;
    end if;
    -- Same person, earlier day, bit-identical fix: GPS never repeats exactly across days.
    if exists (
      select 1 from public.staff_attendance a
      where a.staff_id = uid
        and a.attendance_date < manila::date
        and a.check_in_lat = p_lat
        and a.check_in_lng = p_lng
    ) then
      reasons := reasons || 'replayed_fix'::text;
    end if;

    if cardinality(reasons) > 0 then
      insert into public.attendance_location_alerts (staff_id, branch_slug, reasons, lat, lng, accuracy_m)
      values (uid, p_branch_slug, reasons, p_lat, p_lng, p_accuracy_m)
      returning id into new_alert;

      insert into public.user_notifications (user_id, kind, title, body, url, tag)
      select
        sp.id,
        'attendance_location_alert',
        'Time-in blocked · ' || coalesce(nullif(regexp_replace(coalesce(br.name, ''), '^Hakum(\s+Auto\s+Care)?\M\s*', '', 'i'), ''), p_branch_slug),
        coalesce(prof.full_name, 'A team member') || ' tried to time in with a faked or tampered location. Review it on Attendance.',
        '/operations/attendance',
        'geo-alert-' || new_alert
      from public.staff_profiles sp
      where sp.id <> uid
        and coalesce(sp.is_active, false)
        and not coalesce(sp.is_archived, false)
        and (
          sp.role in ('BossMich', 'assistant_super_admin')
          or (
            sp.role = 'admin'
            and (
              sp.branch_slug = p_branch_slug
              or exists (
                select 1 from public.staff_branch_assignments a
                where a.staff_id = sp.id and a.branch_slug = p_branch_slug
              )
            )
          )
        );

      return jsonb_build_object('ok', false, 'alert_id', new_alert, 'reasons', to_jsonb(reasons));
    end if;
  end if;

  is_late := br.shift_start is not null
    and date_trunc('minute', manila)::time > br.shift_start + interval '5 minutes';

  perform set_config('hakum.geo_clock_in', '1', true);
  insert into public.staff_attendance as sa (
    staff_id, branch_slug, attendance_date, status, checked_in_at, checked_out_at,
    check_in_lat, check_in_lng, check_in_accuracy_m, source, marked_by, notes
  )
  values (
    uid, p_branch_slug, manila::date, case when is_late then 'late' else 'present' end, now(), null,
    p_lat, p_lng, p_accuracy_m, 'geo', uid,
    case when is_late then 'Late vs shift ' || left(br.shift_start::text, 5) end
  )
  on conflict (staff_id, attendance_date) do update set
    branch_slug = excluded.branch_slug,
    status = excluded.status,
    checked_in_at = excluded.checked_in_at,
    checked_out_at = null,
    check_in_lat = excluded.check_in_lat,
    check_in_lng = excluded.check_in_lng,
    check_in_accuracy_m = excluded.check_in_accuracy_m,
    source = 'geo',
    marked_by = uid,
    notes = excluded.notes
  returning sa.id, sa.status, sa.checked_in_at into saved;
  perform set_config('hakum.geo_clock_in', '', true);

  return jsonb_build_object('ok', true, 'id', saved.id, 'status', saved.status, 'checked_in_at', saved.checked_in_at);
end;
$$;

revoke all on function public.geo_clock_in(text, double precision, double precision, double precision, text[]) from public, anon;
grant execute on function public.geo_clock_in(text, double precision, double precision, double precision, text[]) to authenticated;

-- Geo rows only through geo_clock_in, so a direct PostgREST upsert cannot skip the spoof checks.
create or replace function public.enforce_staff_attendance_geofence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  prof record;
  br record;
  dist_m double precision;
begin
  if new.source is distinct from 'geo' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.check_in_lat is not distinct from old.check_in_lat
    and new.check_in_lng is not distinct from old.check_in_lng then
    return new;
  end if;

  if coalesce(current_setting('hakum.geo_clock_in', true), '') <> '1' then
    raise exception 'Time in from the Attendance page';
  end if;

  if new.check_in_lat is null or new.check_in_lng is null then
    raise exception 'Geo clock-in requires coordinates';
  end if;

  select sp.attendance_enabled, sp.geofence_enabled
  into prof
  from public.staff_profiles sp
  where sp.id = new.staff_id;

  if coalesce(prof.attendance_enabled, true) = false then
    raise exception 'Attendance is disabled for this account';
  end if;

  if coalesce(prof.geofence_enabled, true) = false then
    return new;
  end if;

  select b.latitude, b.longitude, b.geofence_radius_m, b.name
  into br
  from public.branches b
  where b.slug = new.branch_slug;

  if br.latitude is null or br.longitude is null then
    raise exception 'Branch has no map pin yet';
  end if;

  dist_m := public.haversine_meters(new.check_in_lat, new.check_in_lng, br.latitude, br.longitude);
  if dist_m > coalesce(br.geofence_radius_m, 20) then
    raise exception 'Outside geofence (% m away; allowed % m)',
      round(dist_m::numeric, 0)::text,
      coalesce(br.geofence_radius_m, 20)::text;
  end if;

  return new;
end;
$$;
