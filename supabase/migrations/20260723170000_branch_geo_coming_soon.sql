-- Branch geo + coming_soon for multi-site future-proofing.
-- schema: lat/lng for nearest-branch + map pin; coming_soon for public announce without booking.

alter table public.branches
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists coming_soon boolean not null default false;

alter table public.branches drop constraint if exists branches_lat_range;
alter table public.branches
  add constraint branches_lat_range check (latitude is null or (latitude >= -90 and latitude <= 90));

alter table public.branches drop constraint if exists branches_lng_range;
alter table public.branches
  add constraint branches_lng_range check (longitude is null or (longitude >= -180 and longitude <= 180));

-- Seed known PH sites (ponytail: fallback until admin re-pins)
update public.branches set latitude = 14.459, longitude = 120.929
where slug = 'bacoor' and latitude is null;
update public.branches set latitude = 13.7563, longitude = 121.0583
where slug = 'batangas' and latitude is null;

create index if not exists idx_branches_public_status
  on public.branches (is_archived, is_active, coming_soon)
  where not is_archived;

-- Replace prior overloads so clients call the geo-aware signatures only
drop function if exists public.create_branch(text, text, text, text);
drop function if exists public.update_branch(text, text, text, text, boolean);

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
returns branches
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := (select auth.uid());
  normalized_slug text := lower(trim(input_slug));
  normalized_code text := upper(trim(input_code));
  created_branch public.branches%rowtype;
  want_coming_soon boolean := coalesce(input_coming_soon, false);
  want_active boolean := coalesce(input_is_active, true);
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
  if input_latitude is not null and (input_latitude < -90 or input_latitude > 90) then
    raise exception using errcode = '23514', message = 'Latitude out of range';
  end if;
  if input_longitude is not null and (input_longitude < -180 or input_longitude > 180) then
    raise exception using errcode = '23514', message = 'Longitude out of range';
  end if;
  -- Coming soon sites are announced but not bookable
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
$function$;

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
returns branches
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := (select auth.uid());
  normalized_code text := upper(trim(input_code));
  updated_branch public.branches%rowtype;
  next_coming_soon boolean;
  next_active boolean;
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
  if input_latitude is not null and (input_latitude < -90 or input_latitude > 90) then
    raise exception using errcode = '23514', message = 'Latitude out of range';
  end if;
  if input_longitude is not null and (input_longitude < -180 or input_longitude > 180) then
    raise exception using errcode = '23514', message = 'Longitude out of range';
  end if;

  select coming_soon, is_active into next_coming_soon, next_active
  from public.branches
  where slug = lower(trim(input_branch_slug)) and not is_archived;

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
  where br.slug = lower(trim(input_branch_slug))
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
$function$;

-- Public may read coming-soon rows (announce) as well as active
drop policy if exists "Public can read active branches" on public.branches;
create policy "Public can read active branches"
  on public.branches for select
  using (
    not is_archived
    and (is_active or coming_soon)
  );

drop policy if exists "Anon can read active branches" on public.branches;
create policy "Anon can read active branches"
  on public.branches for select to anon
  using (
    not is_archived
    and (is_active or coming_soon)
  );

drop policy if exists "Authenticated can read active branches" on public.branches;
create policy "Authenticated can read active branches"
  on public.branches for select to authenticated
  using (
    not is_archived
    and (is_active or coming_soon or public.is_admin() or slug = public.current_user_branch())
  );

revoke all on function public.create_branch(text, text, text, text, double precision, double precision, boolean, boolean) from public, anon;
grant execute on function public.create_branch(text, text, text, text, double precision, double precision, boolean, boolean) to authenticated;

revoke all on function public.update_branch(text, text, text, text, boolean, double precision, double precision, boolean) from public, anon;
grant execute on function public.update_branch(text, text, text, text, boolean, double precision, double precision, boolean) to authenticated;
