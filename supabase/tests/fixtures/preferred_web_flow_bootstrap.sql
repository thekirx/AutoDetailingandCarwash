create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema storage;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create type public.profile_role as enum (
  'customer', 'staff', 'admin', 'BossMich', 'assistant_super_admin',
  'team_lead', 'sales', 'marketing'
);

create table public.staff_profiles (
  id uuid primary key,
  full_name text not null,
  role public.profile_role not null,
  is_active boolean not null default true,
  is_archived boolean not null default false
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  banner_url text,
  branch text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text,
  form_id uuid
);

alter table public.events enable row level security;
grant select on public.events to anon, authenticated;
grant select, insert, update on public.events to authenticated;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  note text
);

alter table public.bookings enable row level security;
grant select, insert, update, delete on public.bookings to authenticated;

create function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.staff_profiles where id = (select auth.uid());
$$;

grant execute on function public.current_user_role() to anon, authenticated;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner_id text
);

alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
