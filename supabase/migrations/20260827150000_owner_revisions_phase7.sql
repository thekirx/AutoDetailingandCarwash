-- Owner Revisions Phase 7: vehicle icons, SLA, customer notify flags, temp role overrides.

-- ---------------------------------------------------------------------------
-- vehicles.icon — preset key for garage / CRM
-- ---------------------------------------------------------------------------
alter table public.vehicles
  add column if not exists icon text;

comment on column public.vehicles.icon is
  'Preset icon key (e.g. sedan, suv, truck) for customer garage / CRM display.';

-- ---------------------------------------------------------------------------
-- services.sla_minutes — optional SLA baseline (duration_minutes already exists)
-- ---------------------------------------------------------------------------
alter table public.services
  add column if not exists sla_minutes integer;

alter table public.services drop constraint if exists services_sla_minutes_positive;
alter table public.services
  add constraint services_sla_minutes_positive
  check (sla_minutes is null or sla_minutes > 0);

comment on column public.services.sla_minutes is
  'Optional SLA minutes for the service; dwell over this is flagged red in queue/KPI.';

-- ---------------------------------------------------------------------------
-- customers.notify_sms / notify_push / is_disabled
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists notify_sms boolean not null default true;

alter table public.customers
  add column if not exists notify_push boolean not null default true;

alter table public.customers
  add column if not exists is_disabled boolean not null default false;

comment on column public.customers.notify_sms is 'CRM: allow transactional SMS.';
comment on column public.customers.notify_push is 'CRM: allow web push.';
comment on column public.customers.is_disabled is 'CRM: disable account notifications / soft mute.';

-- ---------------------------------------------------------------------------
-- staff_role_overrides — temp TL for a Manila calendar day
-- ---------------------------------------------------------------------------
create table if not exists public.staff_role_overrides (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  role text not null,
  branch_slug text not null references public.branches (slug) on delete cascade,
  on_date date not null,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (staff_id, role, branch_slug, on_date)
);

create index if not exists staff_role_overrides_day_idx
  on public.staff_role_overrides (on_date, branch_slug);

create index if not exists staff_role_overrides_staff_day_idx
  on public.staff_role_overrides (staff_id, on_date);

comment on table public.staff_role_overrides is
  'Day-scoped role override (e.g. crew as team_lead for one Manila date). SA/ASA or BA of branch create; SA revoke.';

alter table public.staff_role_overrides enable row level security;

drop policy if exists staff_role_overrides_select on public.staff_role_overrides;
create policy staff_role_overrides_select on public.staff_role_overrides
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_assistant_super_admin()
    or public.user_has_branch_access(branch_slug)
    or staff_id = auth.uid()
  );

drop policy if exists staff_role_overrides_insert on public.staff_role_overrides;
create policy staff_role_overrides_insert on public.staff_role_overrides
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_assistant_super_admin()
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  );

-- Only Super Admin may revoke (delete)
drop policy if exists staff_role_overrides_delete on public.staff_role_overrides;
create policy staff_role_overrides_delete on public.staff_role_overrides
  for delete to authenticated
  using (public.is_super_admin());

grant select, insert, delete on public.staff_role_overrides to authenticated;

-- ---------------------------------------------------------------------------
-- operations_queue_board: expose sla_minutes + duration_minutes
-- ---------------------------------------------------------------------------
drop view if exists public.operations_queue_board;

create view public.operations_queue_board
with (security_invoker = true)
as
select
  b.id as booking_id,
  b.branch,
  b.queue_number,
  b.queue_date,
  b.status,
  b.customer_id,
  b.vehicle_id,
  b.customer_name,
  b.customer_phone,
  b.customer_email,
  b.vehicle_plate,
  b.vehicle_make,
  b.vehicle_model,
  b.vehicle_year,
  b.vehicle_type,
  b.service_id,
  s.name as service_name,
  s.price_minor as base_price_minor,
  b.final_price_minor,
  b.assigned_staff_id,
  sp.full_name as assigned_staff_name,
  b.scheduled_start,
  b.scheduled_end,
  b.estimated_start,
  b.estimated_end,
  b.actual_start,
  b.actual_end,
  b.created_at,
  b.notes,
  b.visit_group_id,
  b.in_progress_at,
  b.final_checking_at,
  b.redo_at,
  b.redo_reason,
  s.pay_category as service_pay_category,
  s.duration_minutes as service_duration_minutes,
  s.sla_minutes as service_sla_minutes
from public.bookings b
left join public.services s on s.id = b.service_id
left join public.staff_profiles sp on sp.id = b.assigned_staff_id
where coalesce(b.is_archived, false) = false;

grant select on public.operations_queue_board to authenticated;
