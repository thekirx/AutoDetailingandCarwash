-- Admin audit trail for Super Admin / Admin mutations (people, branches, services, etc.)
-- Indexed for time + entity lookups (query-missing-indexes).

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_logs_created_at
  on public.audit_logs (created_at desc);

create index if not exists idx_audit_logs_entity
  on public.audit_logs (entity_type, entity_id);

create index if not exists idx_audit_logs_actor_created
  on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs"
  on public.audit_logs for select to authenticated
  using (public.is_admin());

-- No direct inserts from clients — use write_audit_event
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.write_audit_event(
  input_action text,
  input_entity_type text,
  input_entity_id text,
  input_summary text,
  input_meta jsonb default '{}'::jsonb
)
returns public.audit_logs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  row_out public.audit_logs%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Sign in required to write audit events';
  end if;
  if nullif(trim(input_action), '') is null or nullif(trim(input_entity_type), '') is null then
    raise exception using errcode = '23514', message = 'action and entity_type are required';
  end if;

  select sp.role into caller_role
  from public.staff_profiles sp
  where sp.id = caller_id and sp.is_active = true and coalesce(sp.is_archived, false) = false
  limit 1;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller_id,
    caller_role,
    trim(input_action),
    trim(input_entity_type),
    nullif(trim(input_entity_id), ''),
    coalesce(nullif(trim(input_summary), ''), trim(input_action) || ' ' || trim(input_entity_type)),
    coalesce(input_meta, '{}'::jsonb)
  )
  returning * into row_out;

  return row_out;
end;
$$;

revoke all on function public.write_audit_event(text, text, text, text, jsonb) from public, anon;
grant execute on function public.write_audit_event(text, text, text, text, jsonb) to authenticated;

-- Hook branch RPCs so branch CRUD is always audited even if the client forgets
create or replace function public.create_branch(
  input_name text,
  input_slug text,
  input_code text,
  input_address text
)
returns public.branches
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_slug text := lower(trim(input_slug));
  normalized_code text := upper(trim(input_code));
  created_branch public.branches%rowtype;
begin
  if caller_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only BossMich or admin may create branches';
  end if;
  if nullif(trim(input_name), '') is null then
    raise exception using errcode = '23514', message = 'Branch name is required';
  end if;
  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '23514', message = 'Branch slug must be lowercase and URL-safe';
  end if;
  if normalized_code !~ '^[A-Z]{2,5}$' then
    raise exception using errcode = '23514', message = 'Branch code must contain 2 to 5 uppercase letters';
  end if;

  insert into public.branches (
    slug, name, code, address, is_active, is_archived,
    archived_at, created_by, updated_by, created_at, updated_at
  )
  values (
    normalized_slug, trim(input_name), normalized_code, nullif(trim(input_address), ''),
    true, false, null, caller_id, caller_id, clock_timestamp(), clock_timestamp()
  )
  returning * into created_branch;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  select caller_id, sp.role, 'create', 'branch', created_branch.slug,
         'Created branch ' || created_branch.name,
         jsonb_build_object('slug', created_branch.slug, 'code', created_branch.code)
  from public.staff_profiles sp where sp.id = caller_id;

  return created_branch;
end;
$$;

create or replace function public.update_branch(
  input_branch_slug text,
  input_name text,
  input_code text,
  input_address text,
  input_is_active boolean
)
returns public.branches
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_code text := upper(trim(input_code));
  updated_branch public.branches%rowtype;
begin
  if caller_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only BossMich or admin may update branches';
  end if;
  if nullif(trim(input_name), '') is null then
    raise exception using errcode = '23514', message = 'Branch name is required';
  end if;
  if normalized_code !~ '^[A-Z]{2,5}$' then
    raise exception using errcode = '23514', message = 'Branch code must contain 2 to 5 uppercase letters';
  end if;

  update public.branches br
  set name = trim(input_name),
      code = normalized_code,
      address = nullif(trim(input_address), ''),
      is_active = coalesce(input_is_active, br.is_active),
      updated_by = caller_id,
      updated_at = clock_timestamp()
  where br.slug = lower(trim(input_branch_slug))
    and not br.is_archived
  returning * into updated_branch;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active branch not found';
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  select caller_id, sp.role, 'update', 'branch', updated_branch.slug,
         'Updated branch ' || updated_branch.name,
         jsonb_build_object('is_active', updated_branch.is_active, 'code', updated_branch.code)
  from public.staff_profiles sp where sp.id = caller_id;

  return updated_branch;
end;
$$;

create or replace function public.archive_branch(input_branch_slug text)
returns public.branches
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  archived_branch public.branches%rowtype;
begin
  if caller_id is null or not public.is_admin() then
    raise exception using errcode = '42501', message = 'Only BossMich or admin may archive branches';
  end if;

  update public.branches br
  set is_archived = true,
      is_active = false,
      archived_at = clock_timestamp(),
      updated_by = caller_id,
      updated_at = clock_timestamp()
  where br.slug = lower(trim(input_branch_slug))
    and not br.is_archived
  returning * into archived_branch;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active branch not found';
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  select caller_id, sp.role, 'archive', 'branch', archived_branch.slug,
         'Archived branch ' || archived_branch.name,
         '{}'::jsonb
  from public.staff_profiles sp where sp.id = caller_id;

  return archived_branch;
end;
$$;
