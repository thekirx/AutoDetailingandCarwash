begin;

revoke insert on table public.bookings from anon;

grant insert (
  customer_name,
  customer_phone,
  vehicle_make,
  vehicle_model,
  scheduled_start,
  service_id,
  branch,
  status
) on table public.bookings to anon;

commit;
