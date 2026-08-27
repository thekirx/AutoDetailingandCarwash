-- Owner revisions P4: per-branch stock, usage_kind, Sunday recon, restock RLS.
-- Writes use invoker RLS (no SECURITY DEFINER RPCs for restock/recon/set).

begin;

-- ---------------------------------------------------------------------------
-- products.usage_kind — resellable (POS) vs internal (recon only)
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists usage_kind text not null default 'resellable';

alter table public.products drop constraint if exists products_usage_kind_check;
alter table public.products
  add constraint products_usage_kind_check
  check (usage_kind = any (array['resellable'::text, 'internal'::text]));

comment on column public.products.usage_kind is
  'resellable = POS sellable + auto branch deduct; internal = Sunday recon only.';

-- ---------------------------------------------------------------------------
-- product_branch_stock — authoritative per-branch qty
-- ---------------------------------------------------------------------------
create table if not exists public.product_branch_stock (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  branch_slug text not null references public.branches (slug) on delete cascade,
  qty integer not null default 0 check (qty >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (product_id, branch_slug)
);

create index if not exists product_branch_stock_branch_product_idx
  on public.product_branch_stock (branch_slug, product_id);

comment on table public.product_branch_stock is
  'Per-branch on-hand qty. POS sales and recon approve mutate this, not global products.stock_qty.';

-- ---------------------------------------------------------------------------
-- product_stock_movements — movement_type + branch_slug
-- ---------------------------------------------------------------------------
alter table public.product_stock_movements
  add column if not exists movement_type text,
  add column if not exists branch_slug text references public.branches (slug) on delete set null;

update public.product_stock_movements
set movement_type = case
  when reason in ('pos_sale', 'sale') then 'sale'
  when reason in ('restock') then 'restock'
  when reason in ('recon_adjust', 'recon') then 'recon_adjust'
  when reason in ('owner_set', 'set') then 'owner_set'
  else coalesce(movement_type, 'sale')
end
where movement_type is null;

alter table public.product_stock_movements
  alter column movement_type set default 'sale';

alter table public.product_stock_movements
  alter column movement_type set not null;

alter table public.product_stock_movements drop constraint if exists product_stock_movements_movement_type_check;
alter table public.product_stock_movements
  add constraint product_stock_movements_movement_type_check
  check (movement_type = any (array['sale'::text, 'restock'::text, 'recon_adjust'::text, 'owner_set'::text]));

create index if not exists product_stock_movements_branch_idx
  on public.product_stock_movements (branch_slug, created_at desc);

-- ---------------------------------------------------------------------------
-- inventory_recons + lines — BA leftover submit; SA/ASA approve applies qty
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_recons (
  id uuid primary key default gen_random_uuid(),
  branch_slug text not null references public.branches (slug) on delete cascade,
  week_of date not null,
  status text not null default 'submitted'
    check (status = any (array['submitted'::text, 'approved'::text, 'rejected'::text])),
  submitted_by uuid references public.staff_profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.staff_profiles (id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_recons_branch_week_idx
  on public.inventory_recons (branch_slug, week_of desc);

create table if not exists public.inventory_recon_lines (
  id uuid primary key default gen_random_uuid(),
  recon_id uuid not null references public.inventory_recons (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  previous_qty integer not null check (previous_qty >= 0),
  leftover_qty integer not null check (leftover_qty >= 0),
  created_at timestamptz not null default now(),
  unique (recon_id, product_id)
);

create index if not exists inventory_recon_lines_recon_idx
  on public.inventory_recon_lines (recon_id);

comment on table public.inventory_recons is
  'Sunday internal-use recon: BA submits leftover qty; SA approve sets product_branch_stock to leftover.';

-- ---------------------------------------------------------------------------
-- RLS: product_branch_stock
-- ---------------------------------------------------------------------------
alter table public.product_branch_stock enable row level security;

drop policy if exists product_branch_stock_select on public.product_branch_stock;
create policy product_branch_stock_select on public.product_branch_stock
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_assistant_super_admin()
    or public.user_has_branch_access(branch_slug)
  );

-- BA: insert new branch rows (restock creates stock); SA/ASA: any insert
drop policy if exists product_branch_stock_insert on public.product_branch_stock;
create policy product_branch_stock_insert on public.product_branch_stock
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('services_merch'))
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
      and qty >= 0
    )
  );

-- BA + SA/ASA may update; BA decrease blocked by trigger below (restock = increase only).
drop policy if exists product_branch_stock_update on public.product_branch_stock;
create policy product_branch_stock_update on public.product_branch_stock
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('services_merch'))
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  )
  with check (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('services_merch'))
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
      and qty >= 0
    )
  );

-- ponytail: BA restock = increase only; SA/ASA set absolute. Invoker trigger, not DEFINER.
-- complete_pos_sale sets hakum.allow_stock_decrease so BA checkout can deduct.
create or replace function public.guard_branch_stock_ba_increase()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if public.current_user_role() = 'admin'
     and new.qty < old.qty
     and coalesce(current_setting('hakum.allow_stock_decrease', true), '') is distinct from '1' then
    raise exception using errcode = '42501',
      message = 'Branch admin may only restock (increase) branch stock';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists product_branch_stock_ba_guard on public.product_branch_stock;
create trigger product_branch_stock_ba_guard
  before update on public.product_branch_stock
  for each row execute function public.guard_branch_stock_ba_increase();

-- Only SA/ASA may delete stock rows
drop policy if exists product_branch_stock_delete on public.product_branch_stock;
create policy product_branch_stock_delete on public.product_branch_stock
  for delete to authenticated
  using (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('services_merch'))
  );

grant select, insert, update, delete on public.product_branch_stock to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: product_stock_movements (widen write for restock / owner_set / recon)
-- ---------------------------------------------------------------------------
drop policy if exists "Staff read stock movements" on public.product_stock_movements;
drop policy if exists product_stock_movements_select on public.product_stock_movements;
create policy product_stock_movements_select on public.product_stock_movements
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_assistant_super_admin()
    or branch_slug is null
    or public.user_has_branch_access(branch_slug)
  );

drop policy if exists product_stock_movements_insert on public.product_stock_movements;
create policy product_stock_movements_insert on public.product_stock_movements
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      (
        public.is_super_admin()
        or (public.is_assistant_super_admin() and public.asa_has_grant('services_merch'))
      )
      and movement_type = any (array['restock'::text, 'recon_adjust'::text, 'owner_set'::text, 'sale'::text])
      and (branch_slug is null or public.user_has_branch_access(branch_slug) or public.is_super_admin())
    )
    or (
      public.current_user_role() = 'admin'
      and movement_type = 'restock'
      and delta > 0
      and branch_slug is not null
      and public.user_has_branch_access(branch_slug)
    )
  );

grant select, insert on public.product_stock_movements to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: inventory_recons / lines
-- ---------------------------------------------------------------------------
alter table public.inventory_recons enable row level security;
alter table public.inventory_recon_lines enable row level security;

drop policy if exists inventory_recons_select on public.inventory_recons;
create policy inventory_recons_select on public.inventory_recons
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_assistant_super_admin()
    or public.user_has_branch_access(branch_slug)
  );

-- BA submits; SA/ASA may also insert
drop policy if exists inventory_recons_insert on public.inventory_recons;
create policy inventory_recons_insert on public.inventory_recons
  for insert to authenticated
  with check (
    status = 'submitted'
    and (
      public.is_super_admin()
      or (public.is_assistant_super_admin() and public.asa_has_grant('services_merch'))
      or (
        public.current_user_role() = 'admin'
        and public.user_has_branch_access(branch_slug)
      )
    )
  );

-- BA: no status flip to approved. SA/ASA: approve/reject.
drop policy if exists inventory_recons_update on public.inventory_recons;
create policy inventory_recons_update on public.inventory_recons
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('services_merch'))
  )
  with check (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('services_merch'))
  );

drop policy if exists inventory_recon_lines_select on public.inventory_recon_lines;
create policy inventory_recon_lines_select on public.inventory_recon_lines
  for select to authenticated
  using (
    exists (
      select 1 from public.inventory_recons r
      where r.id = recon_id
        and (
          public.is_super_admin()
          or public.is_assistant_super_admin()
          or public.user_has_branch_access(r.branch_slug)
        )
    )
  );

drop policy if exists inventory_recon_lines_insert on public.inventory_recon_lines;
create policy inventory_recon_lines_insert on public.inventory_recon_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from public.inventory_recons r
      where r.id = recon_id
        and r.status = 'submitted'
        and (
          public.is_super_admin()
          or (public.is_assistant_super_admin() and public.asa_has_grant('services_merch'))
          or (
            public.current_user_role() = 'admin'
            and public.user_has_branch_access(r.branch_slug)
          )
        )
    )
  );

grant select, insert, update on public.inventory_recons to authenticated;
grant select, insert on public.inventory_recon_lines to authenticated;

commit;
