-- Hakum Auto Care: Supabase master schema
-- Run this migration in the Supabase SQL editor or through the Supabase CLI.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

do $$
begin
  create type public.profile_role as enum ('customer', 'staff');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.booking_status as enum (
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.transaction_type as enum (
    'sale',
    'refund',
    'expense',
    'adjustment'
  );
exception
  when duplicate_object then null;
end
$$;

-- -----------------------------------------------------------------------------
-- Core tables
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  role public.profile_role not null default 'customer',
  full_name text not null,
  email text,
  phone text,
  loyalty_points integer not null default 0 check (loyalty_points >= 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email is not null;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_minor integer not null check (price_minor >= 0),
  currency char(3) not null default 'PHP',
  duration_minutes integer not null check (duration_minutes > 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  assigned_staff_id uuid references public.profiles (id) on delete restrict,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  vehicle_make text not null,
  vehicle_model text not null,
  vehicle_year smallint check (vehicle_year between 1886 and 2200),
  vehicle_plate text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  status public.booking_status not null default 'pending',
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_valid_schedule
    check (scheduled_end is null or scheduled_end > scheduled_start)
);

create index if not exists bookings_schedule_idx
  on public.bookings (scheduled_start)
  where is_archived = false;

create index if not exists bookings_customer_idx
  on public.bookings (customer_id)
  where is_archived = false;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete restrict,
  customer_id uuid references public.profiles (id) on delete restrict,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  type public.transaction_type not null default 'sale',
  amount_minor integer not null check (amount_minor >= 0),
  currency char(3) not null default 'PHP',
  payment_method text,
  reference_number text,
  description text,
  occurred_at timestamptz not null default now(),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_occurred_at_idx
  on public.transactions (occurred_at desc)
  where is_archived = false;

create index if not exists transactions_booking_idx
  on public.transactions (booking_id)
  where is_archived = false;

-- -----------------------------------------------------------------------------
-- Timestamp and soft-delete triggers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.archive_instead_of_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format(
    'update public.%I set is_archived = true, updated_at = now() where id = $1',
    tg_table_name
  ) using old.id;

  -- Cancels the physical DELETE after archiving the row.
  return null;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists profiles_soft_delete on public.profiles;
create trigger profiles_soft_delete
before delete on public.profiles
for each row execute function public.archive_instead_of_delete();

drop trigger if exists bookings_soft_delete on public.bookings;
create trigger bookings_soft_delete
before delete on public.bookings
for each row execute function public.archive_instead_of_delete();

drop trigger if exists transactions_soft_delete on public.transactions;
create trigger transactions_soft_delete
before delete on public.transactions
for each row execute function public.archive_instead_of_delete();

-- -----------------------------------------------------------------------------
-- RLS helper
-- SECURITY DEFINER prevents recursive profiles-policy evaluation. Access is
-- intentionally restricted to API roles.
-- -----------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and is_archived = false
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.transactions enable row level security;

-- Re-runnable policy creation.
drop policy if exists "Public can view active services" on public.services;
create policy "Public can view active services"
on public.services for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Public can request bookings" on public.bookings;
create policy "Public can request bookings"
on public.bookings for insert
to anon, authenticated
with check (
  status = 'pending'
  and is_archived = false
  and assigned_staff_id is null
);

drop policy if exists "Staff can select profiles" on public.profiles;
create policy "Staff can select profiles"
on public.profiles for select to authenticated
using (public.is_staff());

drop policy if exists "Staff can insert profiles" on public.profiles;
create policy "Staff can insert profiles"
on public.profiles for insert to authenticated
with check (public.is_staff());

drop policy if exists "Staff can update profiles" on public.profiles;
create policy "Staff can update profiles"
on public.profiles for update to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can archive profiles" on public.profiles;
create policy "Staff can archive profiles"
on public.profiles for delete to authenticated
using (public.is_staff());

drop policy if exists "Staff can select services" on public.services;
create policy "Staff can select services"
on public.services for select to authenticated
using (public.is_staff());

drop policy if exists "Staff can insert services" on public.services;
create policy "Staff can insert services"
on public.services for insert to authenticated
with check (public.is_staff());

drop policy if exists "Staff can update services" on public.services;
create policy "Staff can update services"
on public.services for update to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can select bookings" on public.bookings;
create policy "Staff can select bookings"
on public.bookings for select to authenticated
using (public.is_staff());

drop policy if exists "Staff can insert bookings" on public.bookings;
create policy "Staff can insert bookings"
on public.bookings for insert to authenticated
with check (public.is_staff());

drop policy if exists "Staff can update bookings" on public.bookings;
create policy "Staff can update bookings"
on public.bookings for update to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can archive bookings" on public.bookings;
create policy "Staff can archive bookings"
on public.bookings for delete to authenticated
using (public.is_staff());

drop policy if exists "Staff can select transactions" on public.transactions;
create policy "Staff can select transactions"
on public.transactions for select to authenticated
using (public.is_staff());

drop policy if exists "Staff can insert transactions" on public.transactions;
create policy "Staff can insert transactions"
on public.transactions for insert to authenticated
with check (public.is_staff());

drop policy if exists "Staff can update transactions" on public.transactions;
create policy "Staff can update transactions"
on public.transactions for update to authenticated
using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Staff can archive transactions" on public.transactions;
create policy "Staff can archive transactions"
on public.transactions for delete to authenticated
using (public.is_staff());

-- Supabase API table privileges; RLS remains the authorization boundary.
grant select on public.services to anon, authenticated;
grant insert on public.bookings to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update on public.services to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

commit;
