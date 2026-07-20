-- Phase 1–4 platform schema: POS, loyalty, finance, registration, roles, CRM support, public modules, memberships
begin;

-- Roles
do $$ begin alter type public.profile_role add value if not exists 'marketing'; exception when duplicate_object then null; end $$;
do $$ begin alter type public.profile_role add value if not exists 'sales'; exception when duplicate_object then null; end $$;

-- Registration fields on customers
alter table public.customers
  add column if not exists first_name text,
  add column if not exists last_name text;

create or replace function public.sync_customer_full_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.first_name is not null or new.last_name is not null then
    new.full_name := trim(both ' ' from concat_ws(' ', new.first_name, new.last_name));
  end if;
  if new.full_name is null or new.full_name = '' then
    new.full_name := coalesce(nullif(trim(new.first_name), ''), 'Customer');
  end if;
  return new;
end;
$$;

drop trigger if exists customers_sync_full_name on public.customers;
create trigger customers_sync_full_name
before insert or update of first_name, last_name, full_name on public.customers
for each row execute function public.sync_customer_full_name();

-- Products + inventory
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category text not null default 'general',
  price_minor integer not null check (price_minor >= 0),
  currency char(3) not null default 'PHP',
  stock_qty integer not null default 0,
  branch_slug text references public.branches (slug) on delete set null,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  delta integer not null,
  reason text not null,
  sale_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  branch text not null references public.branches (slug),
  customer_id uuid references public.customers (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  pos_handoff_id uuid references public.pos_handoffs (id) on delete set null,
  status text not null default 'paid' check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  payment_method text,
  subtotal_minor integer not null default 0 check (subtotal_minor >= 0),
  total_minor integer not null default 0 check (total_minor >= 0),
  currency char(3) not null default 'PHP',
  notes text,
  recorded_by uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_branch_occurred_idx on public.sales (branch, occurred_at desc);
create index if not exists sales_status_paid_idx on public.sales (status) where status = 'paid';

create table if not exists public.sale_line_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  item_type text not null check (item_type in ('service', 'product')),
  service_id uuid references public.services (id) on delete restrict,
  product_id uuid references public.products (id) on delete restrict,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_minor integer not null check (unit_price_minor >= 0),
  line_total_minor integer not null check (line_total_minor >= 0),
  created_at timestamptz not null default now(),
  constraint sale_line_item_ref check (
    (item_type = 'service' and service_id is not null and product_id is null)
    or (item_type = 'product' and product_id is not null and service_id is null)
  )
);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  delta integer not null,
  reason text not null,
  sale_id uuid references public.sales (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_ledger_customer_idx on public.loyalty_ledger (customer_id, created_at desc);

-- Finance
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_chemical boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.expense_categories (name, is_chemical)
values
  ('General', false),
  ('Utilities', false),
  ('Payroll', false),
  ('Chemicals', true),
  ('Equipment', false),
  ('Marketing', false)
on conflict (name) do nothing;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_cost_minor integer not null check (unit_cost_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  branch text not null references public.branches (slug),
  category_id uuid references public.expense_categories (id),
  attachment_path text,
  status text not null default 'draft' check (
    status in ('draft', 'pending_approval', 'approved', 'pending_payment', 'paid', 'posted')
  ),
  created_by uuid,
  approved_by uuid,
  paid_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_status_events (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  old_status text,
  new_status text not null,
  notes text,
  changed_by uuid,
  created_at timestamptz not null default now()
);

-- Public modules
create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  branch text references public.branches (slug),
  booking_id uuid references public.bookings (id) on delete set null,
  category text not null,
  description text not null,
  attachment_path text,
  status text not null default 'submitted' check (
    status in ('submitted', 'review', 'resolved', 'closed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  banner_url text,
  branch text references public.branches (slug),
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

-- Memberships
create table if not exists public.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starting_price_minor integer not null default 0,
  benefits text[] not null default '{}',
  discount_percent numeric(5,2) not null default 0,
  loyalty_multiplier numeric(5,2) not null default 1,
  included_services text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.membership_tiers (name, starting_price_minor, benefits, discount_percent, loyalty_multiplier, included_services)
values (
  'Platinum',
  999900,
  array['Priority booking', 'Member-only promos', 'Loyalty multiplier'],
  10,
  1.5,
  array['Premium Car Wash']
)
on conflict (name) do nothing;

create table if not exists public.customer_memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  tier_id uuid not null references public.membership_tiers (id) on delete restrict,
  starts_at date not null default current_date,
  ends_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- SMS templates (campaigns log to sms_events)
create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_type text not null check (
    template_type in ('promo', 'reminder', 'loyalty', 'birthday', 'booking_confirm', 'booking_remind')
  ),
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Daily sales view
create or replace view public.daily_sales_summary
with (security_invoker = true)
as
select
  s.branch,
  (s.occurred_at at time zone 'Asia/Manila')::date as sale_date,
  count(*) filter (where s.status = 'paid') as paid_count,
  count(*) filter (where s.status = 'pending') as pending_count,
  count(*) as transaction_count,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid'), 0)::bigint as total_sales_minor,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid' and s.payment_method = 'cash'), 0)::bigint as cash_sales_minor,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid' and s.payment_method in ('online', 'gcash', 'card')), 0)::bigint as online_sales_minor,
  case
    when count(*) filter (where s.status = 'paid') > 0
    then (coalesce(sum(s.total_minor) filter (where s.status = 'paid'), 0)
      / (count(*) filter (where s.status = 'paid')))::bigint
    else 0
  end as average_ticket_minor
from public.sales s
group by 1, 2;

-- complete_pos_sale RPC
create or replace function public.complete_pos_sale(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  v_branch text := payload->>'branch';
  v_customer uuid := nullif(payload->>'customer_id', '')::uuid;
  v_booking uuid := nullif(payload->>'booking_id', '')::uuid;
  v_handoff uuid := nullif(payload->>'pos_handoff_id', '')::uuid;
  v_method text := coalesce(payload->>'payment_method', 'cash');
  v_status text := coalesce(payload->>'status', 'paid');
  line jsonb;
  sale_id uuid;
  subtotal integer := 0;
  service_total integer := 0;
  line_total integer;
  qty integer;
  unit integer;
  prod_id uuid;
  svc_id uuid;
  item_name text;
  loyalty_delta integer;
  multiplier numeric := 1;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if v_branch is null or not exists (
    select 1 from public.branches b where b.slug = v_branch and b.is_active and not b.is_archived
  ) then
    raise exception 'Invalid branch';
  end if;
  if v_status not in ('pending', 'paid') then
    raise exception 'Invalid sale status';
  end if;
  if jsonb_typeof(payload->'lines') is distinct from 'array' or jsonb_array_length(payload->'lines') < 1 then
    raise exception 'At least one line item is required';
  end if;

  insert into public.sales (
    branch, customer_id, booking_id, pos_handoff_id, status, payment_method,
    subtotal_minor, total_minor, recorded_by
  ) values (
    v_branch, v_customer, v_booking, v_handoff, v_status, v_method, 0, 0, caller
  ) returning id into sale_id;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    qty := greatest(coalesce((line->>'quantity')::int, 1), 1);
    unit := coalesce((line->>'unit_price_minor')::int, 0);
    line_total := qty * unit;
    subtotal := subtotal + line_total;
    item_name := coalesce(line->>'name', 'Item');

    if line->>'item_type' = 'product' then
      prod_id := (line->>'product_id')::uuid;
      update public.products p
      set stock_qty = p.stock_qty - qty, updated_at = now()
      where p.id = prod_id and p.stock_qty >= qty and p.is_active and not p.is_archived;
      if not found then
        raise exception 'Insufficient stock for product %', prod_id;
      end if;
      insert into public.product_stock_movements (product_id, delta, reason, sale_id, created_by)
      values (prod_id, -qty, 'pos_sale', sale_id, caller);
      insert into public.sale_line_items (
        sale_id, item_type, product_id, name, quantity, unit_price_minor, line_total_minor
      ) values (sale_id, 'product', prod_id, item_name, qty, unit, line_total);
    elsif line->>'item_type' = 'service' then
      svc_id := (line->>'service_id')::uuid;
      service_total := service_total + line_total;
      insert into public.sale_line_items (
        sale_id, item_type, service_id, name, quantity, unit_price_minor, line_total_minor
      ) values (sale_id, 'service', svc_id, item_name, qty, unit, line_total);
    else
      raise exception 'Invalid item_type';
    end if;
  end loop;

  update public.sales
  set subtotal_minor = subtotal, total_minor = subtotal, updated_at = now()
  where id = sale_id;

  if v_status = 'paid' and v_customer is not null and service_total > 0 then
    select coalesce(mt.loyalty_multiplier, 1) into multiplier
    from public.customer_memberships cm
    join public.membership_tiers mt on mt.id = cm.tier_id
    where cm.customer_id = v_customer and cm.is_active
    order by cm.created_at desc
    limit 1;

    loyalty_delta := greatest(floor((service_total / 100.0) * coalesce(multiplier, 1))::int, 0);
    if loyalty_delta > 0 then
      insert into public.loyalty_ledger (customer_id, delta, reason, sale_id)
      values (v_customer, loyalty_delta, 'service_sale', sale_id);
      update public.customers
      set loyalty_points = loyalty_points + loyalty_delta, updated_at = now()
      where id = v_customer;
    end if;
  end if;

  if v_handoff is not null and v_status = 'paid' then
    update public.pos_handoffs
    set status = 'completed', completed_at = now(), updated_at = now()
    where id = v_handoff;
  end if;

  if v_booking is not null and v_status = 'paid' then
    update public.bookings
    set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
    where id = v_booking;
  end if;

  return jsonb_build_object('sale_id', sale_id, 'total_minor', subtotal, 'loyalty_awarded', coalesce(loyalty_delta, 0));
end;
$$;

revoke all on function public.complete_pos_sale(jsonb) from public, anon;
grant execute on function public.complete_pos_sale(jsonb) to authenticated;

-- Expense transition helper
create or replace function public.transition_expense(p_expense_id uuid, p_new_status text, p_notes text default null)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  exp public.expenses;
  caller uuid := auth.uid();
  cat public.expense_categories;
  needs_approval boolean;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into exp from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Expense not found'; end if;

  select * into cat from public.expense_categories where id = exp.category_id;
  needs_approval := coalesce(cat.is_chemical, false) or exp.total_minor > 500000;

  if p_new_status = 'pending_approval' and exp.status <> 'draft' then
    raise exception 'Only draft expenses can be submitted for approval';
  end if;
  if p_new_status = 'approved' then
    if not public.is_admin() then raise exception 'Only admin can approve'; end if;
    if exp.status <> 'pending_approval' and not (exp.status = 'draft' and not needs_approval) then
      raise exception 'Invalid approval transition';
    end if;
  end if;
  if exp.status in ('approved', 'pending_payment', 'paid', 'posted')
     and p_new_status not in ('pending_payment', 'paid', 'posted')
     and not (select public.current_user_role() = 'BossMich') then
    raise exception 'Approved expenses are locked';
  end if;

  insert into public.expense_status_events (expense_id, old_status, new_status, notes, changed_by)
  values (exp.id, exp.status, p_new_status, p_notes, caller);

  update public.expenses
  set status = p_new_status,
      approved_by = case when p_new_status = 'approved' then caller else approved_by end,
      paid_by = case when p_new_status = 'paid' then caller else paid_by end,
      updated_at = now()
  where id = exp.id
  returning * into exp;

  return exp;
end;
$$;

revoke all on function public.transition_expense(uuid, text, text) from public, anon;
grant execute on function public.transition_expense(uuid, text, text) to authenticated;

-- RLS
alter table public.products enable row level security;
alter table public.product_stock_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_line_items enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_status_events enable row level security;
alter table public.contact_inquiries enable row level security;
alter table public.complaints enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.membership_tiers enable row level security;
alter table public.customer_memberships enable row level security;
alter table public.sms_templates enable row level security;

drop policy if exists "Staff read products" on public.products;
create policy "Staff read products" on public.products for select to authenticated using (true);
drop policy if exists "Admins write products" on public.products;
create policy "Admins write products" on public.products for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Staff read sales" on public.sales;
create policy "Staff read sales" on public.sales for select to authenticated
using ((select public.is_admin()) or (select public.current_user_role()) in ('sales', 'cashier', 'team_lead', 'BossMich'));
drop policy if exists "Staff read sale lines" on public.sale_line_items;
create policy "Staff read sale lines" on public.sale_line_items for select to authenticated
using (exists (select 1 from public.sales s where s.id = sale_id));

drop policy if exists "CRM read loyalty" on public.loyalty_ledger;
create policy "CRM read loyalty" on public.loyalty_ledger for select to authenticated
using ((select public.is_admin()) or (select public.current_user_role()) in ('marketing', 'sales', 'team_lead', 'BossMich'));

drop policy if exists "Admins manage expenses" on public.expenses;
create policy "Admins manage expenses" on public.expenses for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins read expense events" on public.expense_status_events;
create policy "Admins read expense events" on public.expense_status_events for select to authenticated
using ((select public.is_admin()));
drop policy if exists "Anyone read expense categories" on public.expense_categories;
create policy "Anyone read expense categories" on public.expense_categories for select to authenticated using (true);

drop policy if exists "Anon insert contact" on public.contact_inquiries;
create policy "Anon insert contact" on public.contact_inquiries for insert to anon, authenticated with check (true);
drop policy if exists "Admins read contact" on public.contact_inquiries;
create policy "Admins read contact" on public.contact_inquiries for select to authenticated using ((select public.is_admin()));

drop policy if exists "Anon insert complaints" on public.complaints;
create policy "Anon insert complaints" on public.complaints for insert to anon, authenticated with check (true);
drop policy if exists "Staff read complaints" on public.complaints;
create policy "Staff read complaints" on public.complaints for select to authenticated
using ((select public.is_admin()) or (select public.current_user_role()) in ('marketing', 'team_lead'));

drop policy if exists "Public read events" on public.events;
create policy "Public read events" on public.events for select to anon, authenticated using (is_published = true);
drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events" on public.events for all to authenticated
using ((select public.is_admin()) or (select public.current_user_role()) = 'marketing')
with check ((select public.is_admin()) or (select public.current_user_role()) = 'marketing');

drop policy if exists "Anon register events" on public.event_registrations;
create policy "Anon register events" on public.event_registrations for insert to anon, authenticated with check (true);

drop policy if exists "Public read tiers" on public.membership_tiers;
create policy "Public read tiers" on public.membership_tiers for select to anon, authenticated using (is_active = true);
drop policy if exists "Admins manage tiers" on public.membership_tiers;
create policy "Admins manage tiers" on public.membership_tiers for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "CRM read memberships" on public.customer_memberships;
create policy "CRM read memberships" on public.customer_memberships for select to authenticated
using ((select public.is_admin()) or (select public.current_user_role()) in ('marketing', 'sales'));

drop policy if exists "Marketing sms templates" on public.sms_templates;
create policy "Marketing sms templates" on public.sms_templates for all to authenticated
using ((select public.is_admin()) or (select public.current_user_role()) = 'marketing')
with check ((select public.is_admin()) or (select public.current_user_role()) = 'marketing');

drop policy if exists "Staff read stock movements" on public.product_stock_movements;
create policy "Staff read stock movements" on public.product_stock_movements for select to authenticated
using ((select public.is_admin()) or (select public.current_user_role()) in ('sales', 'cashier'));

grant select on public.products to authenticated;
grant select, insert, update on public.products to authenticated;
grant select on public.product_stock_movements to authenticated;
grant select on public.sales to authenticated;
grant select on public.sale_line_items to authenticated;
grant select on public.loyalty_ledger to authenticated;
grant select on public.expense_categories to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select on public.expense_status_events to authenticated;
grant insert on public.contact_inquiries to anon, authenticated;
grant select on public.contact_inquiries to authenticated;
grant insert on public.complaints to anon, authenticated;
grant select, update on public.complaints to authenticated;
grant select on public.events to anon, authenticated;
grant select, insert, update on public.events to authenticated;
grant insert on public.event_registrations to anon, authenticated;
grant select on public.membership_tiers to anon, authenticated;
grant select, insert, update on public.membership_tiers to authenticated;
grant select on public.customer_memberships to authenticated;
grant select, insert, update on public.sms_templates to authenticated;
grant select on public.daily_sales_summary to authenticated;

-- Seed sample products
insert into public.products (name, sku, category, price_minor, stock_qty)
values
  ('Ceramic Top-Up Kit', 'CER-TOP', 'products', 150000, 25),
  ('Interior Freshener', 'INT-FRESH', 'products', 35000, 80),
  ('Microfiber Towel Pack', 'MF-PACK', 'products', 45000, 40)
on conflict (sku) do nothing;

commit;
