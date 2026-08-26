-- O-01: public inquiries via service-role API (revoke direct anon/authenticated INSERT).
-- O-02: server geofence on geo attendance rows (cannot bypass client check via PostgREST).

create or replace function public.haversine_meters(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select 2 * 6371000 * asin(sqrt(least(1.0,
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

revoke all on function public.haversine_meters(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.haversine_meters(double precision, double precision, double precision, double precision) to authenticated;

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
    raise exception 'Outside geofence (%s m away; allowed %s m)',
      round(dist_m::numeric, 0)::text,
      coalesce(br.geofence_radius_m, 20)::text;
  end if;

  return new;
end;
$$;

drop trigger if exists staff_attendance_geofence on public.staff_attendance;
create trigger staff_attendance_geofence
before insert or update on public.staff_attendance
for each row execute function public.enforce_staff_attendance_geofence();

revoke insert on public.contact_inquiries from anon, authenticated;
revoke insert on public.complaints from anon, authenticated;
revoke insert on public.partnership_inquiries from anon, authenticated;
