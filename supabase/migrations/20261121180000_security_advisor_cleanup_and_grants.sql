-- Hardens Supabase Security & Performance Advisors:
-- 1. Replaces 4 SECURITY DEFINER views with narrow SECURITY DEFINER RPCs (SET search_path = public, pg_temp)
--    so Security Advisor reports 0 security_definer_view ERRORs while public queue/stats remain readable without
--    exposing raw bookings RLS to anon.
-- 2. Splits notification_templates_staff_write (FOR ALL) into explicit INSERT/UPDATE/DELETE policies with
--    (select auth.uid()), eliminating auth_rls_initplan & multiple_permissive_policies WARNs.
-- 3. Revokes excessive anon/authenticated DDL and write table grants on sensitive tables.

begin;

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_super_admin'
  ) then
    raise exception 'public.is_super_admin() is missing — aborting';
  end if;

  if to_regclass('public.notification_templates') is null then
    raise exception 'public.notification_templates is missing — run 20261120200000_custom_notification_templates.sql first';
  end if;

  if to_regclass('public.bookings') is null or to_regclass('public.services') is null then
    raise exception 'public.bookings or public.services is missing — aborting';
  end if;
end $$;

-- ── 1. Narrow public non-PII RPCs replacing SECURITY DEFINER views ─────────

create or replace function public.get_public_home_stats()
returns table (
  services_done integer,
  returning_clients integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with done as (
    select
      b.customer_id,
      nullif(btrim(b.customer_phone), '') as phone,
      nullif(btrim(b.vehicle_plate), '') as plate
    from public.bookings b
    where b.status in ('completed', 'for_payment')
  ),
  identified as (
    select coalesce(done.customer_id::text, done.phone, done.plate) as identity
    from done
  )
  select
    (select count(*) from done)::integer as services_done,
    (
      select count(*)::integer
      from (
        select identified.identity
        from identified
        where identified.identity is not null
        group by identified.identity
        having count(*) > 1
      ) repeats
    ) as returning_clients;
$$;

create or replace function public.get_public_queue_counts(p_branch text default null)
returns table (
  branch text,
  waiting_count integer,
  in_progress_count integer,
  final_checking_count integer,
  total_active_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with lines as (
    select
      b.branch,
      coalesce(b.visit_group_id, b.id) as visit_key,
      case b.status
        when 'waiting'::booking_status then 1
        when 'in_progress'::booking_status then 2
        when 'final_checking'::booking_status then 3
        else null::integer
      end as lane_rank
    from public.bookings b
    left join public.services s on s.id = b.service_id
    where b.status in ('waiting'::booking_status, 'in_progress'::booking_status, 'final_checking'::booking_status)
      and coalesce(b.is_archived, false) = false
      and (p_branch is null or b.branch = p_branch)
      and lower(coalesce(s.pay_category, 'general')) <> 'detailing'
      and lower(coalesce(s.slug, '')) not in (
        'ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint', 'paint-protection-film'
      )
  ),
  visits as (
    select lines.branch, lines.visit_key, min(lines.lane_rank) as lane_rank
    from lines
    group by lines.branch, lines.visit_key
  )
  select
    v.branch,
    count(*) filter (where v.lane_rank = 1)::integer as waiting_count,
    count(*) filter (where v.lane_rank = 2)::integer as in_progress_count,
    count(*) filter (where v.lane_rank = 3)::integer as final_checking_count,
    count(*)::integer as total_active_count
  from visits v
  group by v.branch;
$$;

create or replace function public.get_public_queue_floor(p_branch text default null)
returns table (
  booking_id uuid,
  visit_group_id uuid,
  branch text,
  queue_number integer,
  status booking_status,
  vehicle_plate text,
  vehicle_make text,
  vehicle_model text,
  vehicle_type text,
  service_name text,
  service_pay_category text,
  crew_names text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id as booking_id,
    b.visit_group_id,
    b.branch,
    b.queue_number,
    b.status,
    b.vehicle_plate,
    b.vehicle_make,
    b.vehicle_model,
    b.vehicle_type,
    s.name as service_name,
    s.pay_category as service_pay_category,
    (
      select coalesce(string_agg(distinct trim(sp.full_name), ', ' order by trim(sp.full_name)), '')
      from public.queue_assignments qa
      join public.staff_profiles sp on sp.id = qa.staff_id
      where qa.booking_id = b.id
        and qa.status = 'active'
        and coalesce(trim(sp.full_name), '') <> ''
    ) as crew_names
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.status in (
      'waiting'::booking_status,
      'in_progress'::booking_status,
      'final_checking'::booking_status,
      'for_payment'::booking_status,
      'for_releasing'::booking_status
    )
    and coalesce(b.is_archived, false) = false
    and (p_branch is null or b.branch = p_branch)
  order by b.queue_number nulls last, b.created_at asc;
$$;

create or replace function public.get_public_queue_numbers(p_branch text default null)
returns table (
  branch text,
  queue_number integer,
  status booking_status,
  service_pay_category text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.branch,
    b.queue_number,
    b.status,
    s.pay_category as service_pay_category
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.status in ('waiting'::booking_status, 'in_progress'::booking_status, 'final_checking'::booking_status)
    and coalesce(b.is_archived, false) = false
    and (p_branch is null or b.branch = p_branch)
  order by b.queue_number nulls last;
$$;

revoke all on function public.get_public_home_stats() from public;
revoke all on function public.get_public_queue_counts(text) from public;
revoke all on function public.get_public_queue_floor(text) from public;
revoke all on function public.get_public_queue_numbers(text) from public;

grant execute on function public.get_public_home_stats() to anon, authenticated;
grant execute on function public.get_public_queue_counts(text) to anon, authenticated;
grant execute on function public.get_public_queue_floor(text) to anon, authenticated;
grant execute on function public.get_public_queue_numbers(text) to anon, authenticated;

drop view if exists public.public_queue_counts;
drop view if exists public.public_queue_floor;
drop view if exists public.public_queue_numbers;
drop view if exists public.public_home_stats;

-- ── 2. Fix notification_templates RLS (no FOR ALL SELECT overlap, initplan ok) ──

drop policy if exists notification_templates_staff_write on public.notification_templates;
drop policy if exists notification_templates_staff_insert on public.notification_templates;
drop policy if exists notification_templates_staff_update on public.notification_templates;
drop policy if exists notification_templates_staff_delete on public.notification_templates;

create policy notification_templates_staff_insert
  on public.notification_templates
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  );

create policy notification_templates_staff_update
  on public.notification_templates
  for update
  to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  );

create policy notification_templates_staff_delete
  on public.notification_templates
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  );

-- ── 3. Principle of least privilege on sensitive public tables ───────────

revoke all on table
  public.customers,
  public.vehicles,
  public.sales,
  public.payslips,
  public.staff_profiles,
  public.ops_form_submissions,
  public.notification_templates
from anon;

revoke truncate, trigger, references on table
  public.customers,
  public.vehicles,
  public.sales,
  public.payslips,
  public.staff_profiles,
  public.ops_form_submissions,
  public.notification_templates
from authenticated;

grant select, insert, update, delete on public.notification_templates to authenticated;

commit;

analyze public.notification_templates;
analyze public.bookings;
analyze public.customers;
analyze public.blogs;
