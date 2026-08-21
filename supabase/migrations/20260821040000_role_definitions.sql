-- W5 Option A: custom role definitions (baseline template + grants overlay).

create table if not exists public.role_definitions (
  role_key text primary key check (role_key ~ '^[a-z][a-z0-9_]{1,47}$'),
  label text not null,
  baseline_template text not null,
  grants jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_profiles
  add column if not exists custom_role_key text references public.role_definitions(role_key) on delete set null;

create index if not exists staff_profiles_custom_role_idx
  on public.staff_profiles (custom_role_key)
  where custom_role_key is not null;

alter table public.role_definitions enable row level security;

create policy role_definitions_select
  on public.role_definitions for select to authenticated
  using (public.is_staff());

create policy role_definitions_write
  on public.role_definitions for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
