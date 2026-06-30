-- Add a normalized vehicle classification for staff filtering and reporting.

begin;

alter table public.bookings
add column if not exists vehicle_type text;

alter table public.bookings
drop constraint if exists bookings_vehicle_type_check;

alter table public.bookings
add constraint bookings_vehicle_type_check
check (vehicle_type in ('sedan', 'suv', 'pickup', 'van', 'motorcycle', 'other'));

commit;
