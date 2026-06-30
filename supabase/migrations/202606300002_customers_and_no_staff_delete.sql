-- Contract compliance: rename profiles to customers and prohibit staff DELETE.
-- Staff archives records through UPDATE ... SET is_archived = true.

begin;

do $$
begin
  if to_regclass('public.customers') is null
     and to_regclass('public.profiles') is not null then
    alter table public.profiles rename to customers;
  end if;
end
$$;

alter index if exists public.profiles_email_unique
rename to customers_email_unique;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.customers'::regclass
      and tgname = 'profiles_set_updated_at'
  ) then
    alter trigger profiles_set_updated_at on public.customers
    rename to customers_set_updated_at;
  end if;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.customers'::regclass
      and tgname = 'profiles_soft_delete'
  ) then
    alter trigger profiles_soft_delete on public.customers
    rename to customers_soft_delete;
  end if;
end
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers
    where id = auth.uid()
      and role = 'staff'
      and is_archived = false
  );
$$;

drop policy if exists "Staff can archive profiles" on public.customers;
drop policy if exists "Staff can archive customers" on public.customers;
drop policy if exists "Staff can archive services" on public.services;
drop policy if exists "Staff can archive bookings" on public.bookings;
drop policy if exists "Staff can archive transactions" on public.transactions;

revoke delete on public.customers from authenticated;
revoke delete on public.services from authenticated;
revoke delete on public.bookings from authenticated;
revoke delete on public.transactions from authenticated;

commit;
