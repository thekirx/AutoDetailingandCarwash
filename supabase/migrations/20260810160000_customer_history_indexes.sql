-- Customer History search: indexes for plate / phone / branch ledger lookups.

begin;

create index if not exists bookings_branch_created_idx
  on public.bookings (branch, created_at desc);

create index if not exists bookings_vehicle_plate_idx
  on public.bookings (vehicle_plate);

create index if not exists bookings_customer_phone_idx
  on public.bookings (customer_phone);

create index if not exists bookings_customer_id_created_idx
  on public.bookings (customer_id, created_at desc)
  where customer_id is not null;

create index if not exists sales_customer_id_occurred_idx
  on public.sales (customer_id, occurred_at desc)
  where customer_id is not null;

create index if not exists sales_booking_id_idx
  on public.sales (booking_id)
  where booking_id is not null;

create index if not exists sales_branch_occurred_idx
  on public.sales (branch, occurred_at desc);

commit;
