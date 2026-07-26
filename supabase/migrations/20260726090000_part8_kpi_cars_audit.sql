-- Part 8: vehicle catalog for TL picker + widen get_crew_kpi roles

create table if not exists public.vehicle_catalog (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_catalog_make_model_unique unique (make, model)
);

create index if not exists vehicle_catalog_make_active_idx
  on public.vehicle_catalog (make, sort_order)
  where is_active = true;

alter table public.vehicle_catalog enable row level security;

drop policy if exists vehicle_catalog_select on public.vehicle_catalog;
create policy vehicle_catalog_select on public.vehicle_catalog
  for select to authenticated using (true);

drop policy if exists vehicle_catalog_write on public.vehicle_catalog;
create policy vehicle_catalog_write on public.vehicle_catalog
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Anon/public booking forms may need make hints — select for anon too (catalog is not secret)
drop policy if exists vehicle_catalog_select_anon on public.vehicle_catalog;
create policy vehicle_catalog_select_anon on public.vehicle_catalog
  for select to anon using (is_active = true);

grant select on public.vehicle_catalog to authenticated, anon;
grant insert, update, delete on public.vehicle_catalog to authenticated;

-- Seed common PH makes (idempotent)
insert into public.vehicle_catalog (make, model, sort_order) values
  ('Toyota', 'Vios', 0), ('Toyota', 'Wigo', 1), ('Toyota', 'Innova', 2), ('Toyota', 'Fortuner', 3), ('Toyota', 'Hilux', 4),
  ('Mitsubishi', 'Mirage G4', 0), ('Mitsubishi', 'Xpander', 1), ('Mitsubishi', 'Montero Sport', 2),
  ('Honda', 'City', 0), ('Honda', 'BR-V', 1), ('Honda', 'CR-V', 2),
  ('Nissan', 'Almera', 0), ('Nissan', 'Navara', 1),
  ('Hyundai', 'Accent', 0), ('Hyundai', 'Stargazer', 1),
  ('Ford', 'Ranger', 0), ('Ford', 'Everest', 1),
  ('Suzuki', 'Ertiga', 0), ('Suzuki', 'Swift', 1),
  ('Isuzu', 'D-Max', 0), ('Isuzu', 'mu-X', 1)
on conflict (make, model) do nothing;

-- Widen crew KPI RPC roles (keep body; add assistant_super_admin)
create or replace function public.get_crew_kpi(input_start_date date, input_end_date date, input_branch_slug text default null)
returns table(
  staff_id uuid,
  staff_name text,
  branch_slug text,
  branch_name text,
  branch_code text,
  cars_handled bigint,
  completed_deployed_seconds bigint,
  active_jobs bigint,
  active_deployed_seconds bigint,
  average_completed_seconds numeric,
  cancelled_assignments bigint
)
language plpgsql
security definer
set search_path to pg_catalog, public
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  effective_branch text := input_branch_slug;
  range_start timestamptz;
  range_end timestamptz;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if input_start_date is null or input_end_date is null or input_end_date < input_start_date then
    raise exception using errcode = '22007', message = 'A valid inclusive date range is required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'team_lead', 'assistant_super_admin') then
    raise exception using errcode = '42501', message = 'Crew KPI access is restricted';
  end if;

  if caller_role = 'team_lead' then
    if effective_branch is not null
       and effective_branch is distinct from public.current_user_branch() then
      raise exception using errcode = '42501', message = 'Team leads may only view their own branch KPI';
    end if;
    effective_branch := public.current_user_branch();
  end if;

  if effective_branch is not null
     and not exists (select 1 from public.branches br where br.slug = effective_branch) then
    raise exception using errcode = 'P0002', message = 'Branch not found';
  end if;

  range_start := input_start_date::timestamp at time zone 'Asia/Manila';
  range_end := (input_end_date + 1)::timestamp at time zone 'Asia/Manila';

  return query
  with completed_sessions as (
    select qa.staff_id,
      b.branch,
      count(distinct qa.booking_id)::bigint as cars_handled,
      floor(sum(extract(epoch from (coalesce(qa.released_at, qa.completed_at) - qa.started_at))))::bigint
        as completed_seconds
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where qa.status = 'released'
      and qa.started_at is not null
      and coalesce(qa.released_at, qa.completed_at) is not null
      and coalesce(qa.released_at, qa.completed_at) >= range_start
      and coalesce(qa.released_at, qa.completed_at) < range_end
      and (effective_branch is null or b.branch = effective_branch)
    group by qa.staff_id, b.branch
  ),
  active_sessions as (
    select qa.staff_id,
      b.branch,
      count(*)::bigint as active_jobs,
      floor(sum(greatest(0, extract(epoch from (clock_timestamp() - qa.started_at)))))::bigint
        as active_seconds
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where qa.status = 'active'
      and qa.started_at is not null
      and (effective_branch is null or b.branch = effective_branch)
    group by qa.staff_id, b.branch
  ),
  cancelled_sessions as (
    select qa.staff_id,
      b.branch,
      count(*)::bigint as cancelled_count
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where qa.status = 'cancelled'
      and qa.cancelled_at >= range_start
      and qa.cancelled_at < range_end
      and (effective_branch is null or b.branch = effective_branch)
    group by qa.staff_id, b.branch
  ),
  metric_keys as (
    select c.staff_id, c.branch from completed_sessions c
    union
    select a.staff_id, a.branch from active_sessions a
    union
    select x.staff_id, x.branch from cancelled_sessions x
  )
  select k.staff_id,
    sp.full_name,
    k.branch,
    br.name,
    br.code,
    coalesce(c.cars_handled, 0),
    coalesce(c.completed_seconds, 0),
    coalesce(a.active_jobs, 0),
    coalesce(a.active_seconds, 0),
    case
      when coalesce(c.cars_handled, 0) = 0 then 0::numeric
      else c.completed_seconds::numeric / c.cars_handled::numeric
    end,
    coalesce(x.cancelled_count, 0)
  from metric_keys k
  join public.staff_profiles sp on sp.id = k.staff_id
  join public.branches br on br.slug = k.branch
  left join completed_sessions c on c.staff_id = k.staff_id and c.branch = k.branch
  left join active_sessions a on a.staff_id = k.staff_id and a.branch = k.branch
  left join cancelled_sessions x on x.staff_id = k.staff_id and x.branch = k.branch
  order by br.name, sp.full_name, sp.id;
end;
$function$;

revoke all on function public.get_crew_kpi(date, date, text) from public, anon;
grant execute on function public.get_crew_kpi(date, date, text) to authenticated;
