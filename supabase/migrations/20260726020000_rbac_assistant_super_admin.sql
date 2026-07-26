-- Part 1 RBAC: assistant_super_admin, permission_grants, multi-branch; migrate sales/cashier → admin

do $$ begin
  alter type public.profile_role add value if not exists 'assistant_super_admin';
exception when duplicate_object then null;
end $$;

alter table public.staff_profiles
  add column if not exists permission_grants jsonb not null default '{}'::jsonb;

alter table public.staff_profiles
  drop constraint if exists staff_profiles_permission_grants_object;
alter table public.staff_profiles
  add constraint staff_profiles_permission_grants_object
  check (jsonb_typeof(permission_grants) = 'object');

create table if not exists public.staff_branch_assignments (
  staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  branch_slug text not null references public.branches (slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_id, branch_slug)
);

create index if not exists staff_branch_assignments_branch_idx
  on public.staff_branch_assignments (branch_slug);

alter table public.staff_branch_assignments enable row level security;

drop policy if exists staff_branch_assignments_select on public.staff_branch_assignments;
create policy staff_branch_assignments_select on public.staff_branch_assignments
  for select to authenticated
  using (
    staff_id = auth.uid()
    or public.current_user_role() in ('BossMich', 'assistant_super_admin', 'admin')
  );

drop policy if exists staff_branch_assignments_write on public.staff_branch_assignments;
create policy staff_branch_assignments_write on public.staff_branch_assignments
  for all to authenticated
  using (public.current_user_role() in ('BossMich', 'assistant_super_admin'))
  with check (public.current_user_role() in ('BossMich', 'assistant_super_admin'));

grant select, insert, update, delete on public.staff_branch_assignments to authenticated;

insert into public.staff_branch_assignments (staff_id, branch_slug)
select sp.id, sp.branch_slug
from public.staff_profiles sp
where sp.branch_slug is not null
  and sp.role::text in ('admin', 'team_lead', 'staff', 'marketing', 'sales', 'cashier')
on conflict do nothing;

update public.staff_profiles
set role = 'admin',
    updated_at = now()
where role::text in ('sales', 'cashier');

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.current_user_role() = 'BossMich';
$$;

create or replace function public.is_assistant_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.current_user_role() = 'assistant_super_admin';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.current_user_role() in ('admin', 'BossMich', 'assistant_super_admin');
$$;
