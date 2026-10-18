-- Minimal stand-ins for the live tables/helpers the referral migration touches.
-- Local only. Run: see run.sh in this folder.
create extension if not exists pgcrypto;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.cur (uid uuid);
insert into auth.cur values (null);
create function auth.uid() returns uuid language sql stable as $$ select uid from auth.cur limit 1 $$;
create table public.customers (id uuid primary key, full_name text, phone text);
create table public.services (id uuid primary key default gen_random_uuid(), slug text, name text, pay_category text, is_active boolean default true);
create table public.sales (id uuid primary key default gen_random_uuid(), customer_id uuid, status text, occurred_at timestamptz default now(), created_at timestamptz default now());
create table public.sale_line_items (id uuid primary key default gen_random_uuid(), sale_id uuid references public.sales(id), service_id uuid, quantity int default 1, unit_price_minor int, line_total_minor int);
create table public.notification_templates (key text primary key, title text, body text, sms_body text, enabled boolean default true, updated_at timestamptz default now(), updated_by uuid);
create table public.staff (id uuid primary key);
create function public.is_staff() returns boolean language sql stable as $$ select exists(select 1 from public.staff where id = auth.uid()) $$;
create function public.is_super_admin() returns boolean language sql stable as $$ select false $$;
insert into public.services (slug, name, pay_category) values
 ('premium-car-wash','Carwash','wash'),('express-wash-package','Express Wash Package','package'),('engine-wash','Engine Wash','addon'),
 ('glass-detailing','Glass Detailing','addon'),('full-care-package','Full Care Package','package'),('hakum-custom-package','Hakum Custom Package','package'),
 ('interior-detailing','Interior Detailing','general'),('full-exterior-detailing','Full Exterior Detailing','general'),
 ('ceramic-coating','Ceramic Coating','detailing'),('nano-ceramic-tint','Nano Ceramic Tint','detailing'),('ppf-basic','Basic PPF Protection','detailing'),('paint-maintenance','Paint Maintenance','detailing');
