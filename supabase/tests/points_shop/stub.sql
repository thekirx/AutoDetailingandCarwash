-- Disposable local database ONLY. Minimum shapes used by the migration.
create extension if not exists pgcrypto;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table branches(slug text primary key, is_active boolean default true, is_archived boolean default false);
create table customers(id uuid primary key default gen_random_uuid(), full_name text, loyalty_points integer default 0);
create table staff_profiles(id uuid primary key default gen_random_uuid(), role text, permission_grants jsonb default '{}', branch_slug text, is_active boolean default true, is_archived boolean default false);
create table staff_branch_assignments(staff_id uuid, branch_slug text);
create table products(id uuid primary key default gen_random_uuid(), name text, sku text, category text, price_minor integer default 0, stock_qty integer default 0, tags text[], usage_kind text, stock_category text, show_in_pos boolean, points_price integer, size_options jsonb default '[]', is_active boolean default true, is_archived boolean default false);
create table accessory_redemptions(id uuid primary key default gen_random_uuid(), customer_id uuid references customers, product_id uuid references products, branch_slug text references branches, points_spent integer, status text default 'pending' check(status in ('pending','fulfilled')), created_at timestamptz default now());
alter table accessory_redemptions enable row level security;
create policy accessory_redemptions_select on accessory_redemptions for select to authenticated using(true);
create table product_branch_stock(product_id uuid references products, branch_slug text references branches, size_key text default '', qty integer check(qty >= 0), updated_at timestamptz default now(), unique(product_id,branch_slug,size_key));
create table loyalty_ledger(customer_id uuid, delta integer, reason text);
create table product_stock_movements(product_id uuid, branch_slug text, size_key text, delta integer, reason text, movement_type text);
create table user_notifications(user_id uuid, kind text, tag text);
-- Legacy unsized/fulfilled fixtures are created before the migration.
insert into branches values('bacoor'),('imus');
insert into customers(id,full_name,loyalty_points) values('00000000-0000-4000-8000-000000000001','Alex',200);
insert into products(id,name,usage_kind) values('00000000-0000-4000-8000-000000000002','Legacy unsized','resellable');
insert into accessory_redemptions(id,customer_id,product_id,branch_slug,points_spent,status,created_at) values
 ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','bacoor',20,'pending',now()-interval '30 days'),
 ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','bacoor',20,'fulfilled',now()-interval '30 days');
