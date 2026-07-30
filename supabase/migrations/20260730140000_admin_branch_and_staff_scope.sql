-- Admin branch scope: create sites = SA/ASA; update = branch access; staff_profiles writes scoped
begin;

-- create_branch: Super Admin or ASA with branches grant (not bare branch Admin)
create or replace function public.create_branch(
  input_name text,
  input_slug text,
  input_code text,
  input_address text,
  input_latitude double precision default null,
  input_longitude double precision default null,
  input_coming_soon boolean default false,
  input_is_active boolean default true
)
returns public.branches
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_slug text := lower(trim(input_slug));
  normalized_code text := upper(trim(input_code));
  created_branch public.branches%rowtype;
  want_coming_soon boolean := coalesce(input_coming_soon, false);
  want_active boolean := coalesce(input_is_active, true);
begin
  if caller_id is null
     or not (
       public.is_super_admin()
       or (public.is_assistant_super_admin() and public.asa_has_grant('branches'))
     )
  then
    raise exception using errcode = '42501', message = 'Only Super Admin (or ASA with branches grant) may create branches';
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
  if input_latitude is not null and (input_latitude < -90 or input_latitude > 90) then
    raise exception using errcode = '23514', message = 'Latitude out of range';
  end if;
  if input_longitude is not null and (input_longitude < -180 or input_longitude > 180) then
    raise exception using errcode = '23514', message = 'Longitude out of range';
  end if;
  if want_coming_soon then
    want_active := false;
  end if;

  insert into public.branches (
    slug, name, code, address, latitude, longitude, coming_soon,
    is_active, is_archived, archived_at, created_by, updated_by, created_at, updated_at
  )
  values (
    normalized_slug, trim(input_name), normalized_code, nullif(trim(input_address), ''),
    input_latitude, input_longitude, want_coming_soon,
    want_active, false, null, caller_id, caller_id, clock_timestamp(), clock_timestamp()
  )
  returning * into created_branch;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  select caller_id, sp.role, 'create', 'branch', created_branch.slug,
         'Created branch ' || created_branch.name,
         jsonb_build_object(
           'slug', created_branch.slug,
           'code', created_branch.code,
           'coming_soon', created_branch.coming_soon,
           'is_active', created_branch.is_active,
           'has_geo', (created_branch.latitude is not null)
         )
  from public.staff_profiles sp where sp.id = caller_id;

  return created_branch;
end;
$$;

-- update_branch: SA/ASA(branches) or Admin with user_has_branch_access
create or replace function public.update_branch(
  input_branch_slug text,
  input_name text,
  input_code text,
  input_address text,
  input_is_active boolean,
  input_latitude double precision default null,
  input_longitude double precision default null,
  input_coming_soon boolean default null
)
returns public.branches
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  caller_id uuid := (select auth.uid());
  normalized_code text := upper(trim(input_code));
  target_slug text := lower(trim(input_branch_slug));
  updated_branch public.branches%rowtype;
  next_coming_soon boolean;
  next_active boolean;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('branches'))
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(target_slug)
    )
  ) then
    raise exception using errcode = '42501', message = 'Not allowed to update this branch';
  end if;
  if nullif(trim(input_name), '') is null then
    raise exception using errcode = '23514', message = 'Branch name is required';
  end if;
  if normalized_code !~ '^[A-Z]{2,5}$' then
    raise exception using errcode = '23514', message = 'Branch code must contain 2 to 5 uppercase letters';
  end if;
  if input_latitude is not null and (input_latitude < -90 or input_latitude > 90) then
    raise exception using errcode = '23514', message = 'Latitude out of range';
  end if;
  if input_longitude is not null and (input_longitude < -180 or input_longitude > 180) then
    raise exception using errcode = '23514', message = 'Longitude out of range';
  end if;

  select coming_soon, is_active into next_coming_soon, next_active
  from public.branches
  where slug = target_slug and not is_archived;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active branch not found';
  end if;

  if input_coming_soon is not null then
    next_coming_soon := input_coming_soon;
  end if;
  if input_is_active is not null then
    next_active := input_is_active;
  end if;
  if next_coming_soon then
    next_active := false;
  end if;

  update public.branches br
  set name = trim(input_name),
      code = normalized_code,
      address = nullif(trim(input_address), ''),
      latitude = coalesce(input_latitude, br.latitude),
      longitude = coalesce(input_longitude, br.longitude),
      coming_soon = next_coming_soon,
      is_active = next_active,
      updated_by = caller_id,
      updated_at = clock_timestamp()
  where br.slug = target_slug
    and not br.is_archived
  returning * into updated_branch;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  select caller_id, sp.role, 'update', 'branch', updated_branch.slug,
         'Updated branch ' || updated_branch.name,
         jsonb_build_object(
           'is_active', updated_branch.is_active,
           'coming_soon', updated_branch.coming_soon,
           'code', updated_branch.code,
           'has_geo', (updated_branch.latitude is not null)
         )
  from public.staff_profiles sp where sp.id = caller_id;

  return updated_branch;
end;
$$;

-- staff_profiles: branch Admin may only manage staff/team_lead on assigned branches
drop policy if exists "Authorized users can read staff profiles" on public.staff_profiles;
create policy "Authorized users can read staff profiles"
on public.staff_profiles
for select
to authenticated
using (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or id = (select auth.uid())
  or (
    public.current_user_role() = 'admin'
    and (
      public.user_has_branch_access(branch_slug)
      or exists (
        select 1
        from public.staff_branch_assignments sba
        where sba.staff_id = staff_profiles.id
          and public.user_has_branch_access(sba.branch_slug)
      )
    )
  )
  or (
    public.is_team_lead()
    and branch_slug = public.current_user_branch()
  )
);

drop policy if exists "Queue managers can insert branch staff" on public.staff_profiles;
create policy "Queue managers can insert branch staff"
on public.staff_profiles
for insert
to authenticated
with check (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or (
    public.current_user_role() = 'admin'
    and public.user_has_branch_access(branch_slug)
    and role in ('staff', 'team_lead')
  )
  or (
    public.is_team_lead()
    and branch_slug = public.current_user_branch()
    and role = 'staff'
  )
);

drop policy if exists "Queue managers can update branch staff" on public.staff_profiles;
create policy "Queue managers can update branch staff"
on public.staff_profiles
for update
to authenticated
using (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or (
    public.current_user_role() = 'admin'
    and public.user_has_branch_access(branch_slug)
    and role in ('staff', 'team_lead')
  )
  or (
    public.is_team_lead()
    and branch_slug = public.current_user_branch()
  )
)
with check (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or (
    public.current_user_role() = 'admin'
    and public.user_has_branch_access(branch_slug)
    and role in ('staff', 'team_lead')
  )
  or (
    public.is_team_lead()
    and branch_slug = public.current_user_branch()
    and role = 'staff'
  )
);

commit;
