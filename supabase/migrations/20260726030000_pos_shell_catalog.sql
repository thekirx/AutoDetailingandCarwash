-- Part 2: pay_category, vehicle_sizes, stock_group + sync trigger, assistant payment handoff

alter table public.services
  add column if not exists pay_category text not null default 'general';

create index if not exists services_pay_category_idx on public.services (pay_category) where not is_archived;

create table if not exists public.vehicle_sizes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.vehicle_sizes (slug, label, sort_order) values
  ('sedan', 'Sedan', 10),
  ('suv', 'SUV', 20),
  ('pickup', 'Pickup', 30),
  ('van', 'Van', 40),
  ('motorcycle', 'Motorcycle', 50),
  ('other', 'Other', 90)
on conflict (slug) do nothing;

alter table public.vehicle_sizes enable row level security;

drop policy if exists vehicle_sizes_select on public.vehicle_sizes;
create policy vehicle_sizes_select on public.vehicle_sizes for select to authenticated using (true);

drop policy if exists vehicle_sizes_write on public.vehicle_sizes;
create policy vehicle_sizes_write on public.vehicle_sizes for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant select on public.vehicle_sizes to authenticated;
grant insert, update, delete on public.vehicle_sizes to authenticated;

alter table public.products
  add column if not exists stock_group text;

update public.products
set stock_group = lower(trim(regexp_replace(name, '\s+', ' ', 'g')))
where stock_group is null and name is not null;

create index if not exists products_stock_group_idx
  on public.products (stock_group)
  where stock_group is not null and not is_archived;

create or replace function public.trg_products_sync_stock_group()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE'
     and new.stock_qty is distinct from old.stock_qty
     and new.stock_group is not null
     and new.stock_group <> '' then
    update public.products p
    set stock_qty = new.stock_qty,
        updated_at = clock_timestamp()
    where p.stock_group = new.stock_group
      and p.id is distinct from new.id
      and not coalesce(p.is_archived, false)
      and p.stock_qty is distinct from new.stock_qty;
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_stock_group on public.products;
create trigger products_sync_stock_group
  after update of stock_qty on public.products
  for each row execute function public.trg_products_sync_stock_group();
