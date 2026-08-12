-- Hakum ops redesign: roles, staff toggles, for_releasing, planner proof, reviews, vehicle photos, compensation.
-- Targets profile_role (not staff_role) on this project.

-- 1) booking_status: for_releasing (detailing pipeline)
alter type public.booking_status add value if not exists 'for_releasing';

-- 2) profile_role expansion
alter type public.profile_role add value if not exists 'detailer';
alter type public.profile_role add value if not exists 'video_editor';
alter type public.profile_role add value if not exists 'investor';

-- 3) Per-employee attendance / geofence / employment type
alter table public.staff_profiles
  add column if not exists attendance_enabled boolean not null default true,
  add column if not exists geofence_enabled boolean not null default true,
  add column if not exists employment_type text not null default 'permanent';

do $$
begin
  alter table public.staff_profiles drop constraint if exists staff_profiles_employment_type_check;
exception when undefined_object then null;
end $$;

alter table public.staff_profiles
  add constraint staff_profiles_employment_type_check
  check (employment_type in ('permanent', 'on_call'));

-- 4) Planner proof-of-work
alter table public.plan_card_assignees
  add column if not exists proof_url text,
  add column if not exists proof_note text,
  add column if not exists proof_submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

alter table public.plan_card_assignees
  drop constraint if exists plan_card_assignees_status_check;

alter table public.plan_card_assignees
  add constraint plan_card_assignees_status_check
  check (status in ('todo', 'in_progress', 'for_review', 'done'));

-- 5) Customer reviews
create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  branch text,
  customer_name text,
  overall_rating int not null check (overall_rating between 1 and 5),
  app_rating int check (app_rating between 1 and 5),
  service_rating int check (service_rating between 1 and 5),
  detailing_rating int check (detailing_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists service_reviews_branch_created_idx
  on public.service_reviews (branch, created_at desc);

create index if not exists service_reviews_booking_idx
  on public.service_reviews (booking_id);

alter table public.service_reviews enable row level security;

drop policy if exists service_reviews_select_ops on public.service_reviews;
create policy service_reviews_select_ops on public.service_reviews
  for select to authenticated
  using (true);

drop policy if exists service_reviews_insert_authenticated on public.service_reviews;
create policy service_reviews_insert_authenticated on public.service_reviews
  for insert to authenticated
  with check (true);

-- 6) Vehicle photos
alter table public.vehicles
  add column if not exists photo_path text,
  add column if not exists photo_url text;

-- 7) Compensation rules (SA-configurable singleton)
create table if not exists public.compensation_settings (
  id int primary key default 1 check (id = 1),
  wash_pool_pct numeric not null default 35,
  ceramic_shirt_deduction_minor int not null default 50000,
  ceramic_card_fee_pct numeric not null default 3.5,
  ceramic_crew_solo_pct numeric not null default 20,
  ceramic_crew_split_pct numeric not null default 10,
  ceramic_detailer_split_pct numeric not null default 10,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.compensation_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.compensation_settings enable row level security;

drop policy if exists compensation_settings_select on public.compensation_settings;
create policy compensation_settings_select on public.compensation_settings
  for select to authenticated
  using (true);

drop policy if exists compensation_settings_write_sa on public.compensation_settings;
create policy compensation_settings_write_sa on public.compensation_settings
  for all to authenticated
  using (public.current_user_role() in ('BossMich', 'assistant_super_admin'))
  with check (public.current_user_role() in ('BossMich', 'assistant_super_admin'));

-- 8) POS expense kind on expenses
alter table public.expenses
  add column if not exists expense_kind text default 'daily';

do $$
begin
  alter table public.expenses drop constraint if exists expenses_expense_kind_check;
exception when undefined_object then null;
end $$;

alter table public.expenses
  add constraint expenses_expense_kind_check
  check (expense_kind in ('daily', 'monthly', 'salary_carwash', 'salary_detailer', 'salary_tinter', 'other_branch', 'cash_advance', 'other'));

create index if not exists expenses_expense_kind_idx
  on public.expenses (expense_kind);

comment on column public.staff_profiles.attendance_enabled is 'When false, clock UI is hidden for this employee.';
comment on column public.staff_profiles.geofence_enabled is 'When false, attendance skips geofence enforcement.';
comment on column public.staff_profiles.employment_type is 'permanent | on_call';
