create extension if not exists "pgcrypto";

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  vehicle_model text not null,
  preferred_at timestamp with time zone not null,
  branch text not null,
  service_requested text not null,
  status text not null default 'pending',
  created_at timestamp with time zone not null default now()
);

alter table public.bookings enable row level security;

create policy "Public can request bookings"
on public.bookings
for insert
to anon, authenticated
with check (status = 'pending');

-- No public SELECT policy is intentional: booking details remain staff-only.
