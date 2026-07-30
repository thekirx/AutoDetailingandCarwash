-- Team Lead scope: fail-closed KPI, branch-scoped sales/complaints/loyalty, tighten staff/customer writes
begin;

-- TL-C3: get_crew_kpi — never treat null TL branch as company-wide
create or replace function public.get_crew_kpi(
  input_start_date date,
  input_end_date date,
  input_branch_slug text default null
)
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
set search_path to 'pg_catalog', 'public'
as $$
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
    if public.current_user_branch() is null then
      raise exception using errcode = '42501', message = 'Team lead has no assigned branch';
    end if;
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
$$;

-- TL-C4: sales read — TL only own branch; Admin via user_has_branch_access
drop policy if exists "Staff read sales" on public.sales;
create policy "Staff read sales"
on public.sales
for select
to authenticated
using (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or (
    public.current_user_role() = 'admin'
    and public.user_has_branch_access(branch)
  )
  or (
    public.current_user_role() = 'team_lead'
    and branch = public.current_user_branch()
  )
  or public.current_user_role() in ('sales', 'cashier')
);

-- TL-H2: complaints — TL own branch when column exists
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'complaints' and column_name = 'branch'
  ) then
    drop policy if exists "Staff read complaints" on public.complaints;
    execute $p$
      create policy "Staff read complaints"
      on public.complaints
      for select
      to authenticated
      using (
        public.is_admin()
        or public.current_user_role() = 'marketing'
        or (
          public.current_user_role() = 'team_lead'
          and branch = public.current_user_branch()
        )
      )
    $p$;
  end if;
end $$;

-- TL-H8: loyalty — drop bare team_lead company-wide read
drop policy if exists "CRM read loyalty" on public.loyalty_ledger;
create policy "CRM read loyalty"
on public.loyalty_ledger
for select
to authenticated
using (
  public.is_admin()
  or public.current_user_role() in ('marketing', 'sales', 'BossMich')
);

-- TL-H7: customers UPDATE — remove team_lead (provision API / SA/Admin/marketing keep write)
drop policy if exists "CRM and queue can update customers" on public.customers;
create policy "CRM and queue can update customers"
on public.customers
for update
to authenticated
using (
  public.current_user_role() = any (array['admin'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text, 'assistant_super_admin'::text])
)
with check (
  public.current_user_role() = any (array['admin'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text, 'assistant_super_admin'::text])
);

-- TL-H1: staff_profiles — TL may only touch staff rows on own branch
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
    and role = 'staff'
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

-- Vehicles: TL manage only rows at own branch (last_branch null allowed for new upserts)
drop policy if exists "Allow operations manage vehicles" on public.vehicles;
create policy "Allow operations manage vehicles"
on public.vehicles
for all
to authenticated
using (
  public.current_user_role() = any (array['admin'::text, 'staff'::text])
  or (
    public.is_team_lead()
    and (last_branch is null or last_branch = public.current_user_branch())
  )
)
with check (
  public.current_user_role() = any (array['admin'::text, 'staff'::text])
  or (
    public.is_team_lead()
    and (last_branch is null or last_branch = public.current_user_branch())
  )
);

commit;
