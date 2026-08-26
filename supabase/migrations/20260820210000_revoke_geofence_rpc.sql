-- Trigger-only geofence enforcer must not be callable via PostgREST RPC.
revoke all on function public.enforce_staff_attendance_geofence() from public;
revoke all on function public.enforce_staff_attendance_geofence() from anon;
revoke all on function public.enforce_staff_attendance_geofence() from authenticated;

-- Harden search_path on the geofence helper used by the trigger.
alter function public.haversine_meters(double precision, double precision, double precision, double precision)
  set search_path = public, pg_temp;
