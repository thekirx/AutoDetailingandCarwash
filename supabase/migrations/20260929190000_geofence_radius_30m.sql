-- Geo time-in radius 20 m -> 30 m for the two live shops (owner's call,
-- 2026-09-29): 20 m was tight for phone GPS, especially indoors.

begin;

update public.branches set geofence_radius_m = 30 where slug in ('bacoor', 'batangas');

commit;
