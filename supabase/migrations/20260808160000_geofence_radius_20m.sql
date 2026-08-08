-- Shop-floor geofence: allow 20m (was min 30 / default 150)
alter table public.branches
  drop constraint if exists branches_geofence_radius_m_check;
alter table public.branches
  add constraint branches_geofence_radius_m_check check (geofence_radius_m between 20 and 5000);

alter table public.branches
  alter column geofence_radius_m set default 20;

update public.branches
set geofence_radius_m = 20
where geofence_radius_m is null or geofence_radius_m > 20;
