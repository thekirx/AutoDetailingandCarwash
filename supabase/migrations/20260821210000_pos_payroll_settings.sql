-- POS + Payroll settings: singleton ops_pos_settings + compensation policy columns.

create table if not exists public.ops_pos_settings (
  id int primary key default 1 check (id = 1),
  payment_methods jsonb not null default '[
    {"value":"cash","label":"Cash"},
    {"value":"gcash","label":"GCash"},
    {"value":"card","label":"Credit Cards"}
  ]'::jsonb,
  expense_kinds jsonb not null default '[
    {"value":"daily","label":"Daily expense"},
    {"value":"salary_carwash","label":"Carwash salary"},
    {"value":"salary_detailer","label":"Detailer salary"},
    {"value":"salary_tinter","label":"Tinter salary"},
    {"value":"monthly","label":"Monthly expense"},
    {"value":"other_branch","label":"Other branch expense"},
    {"value":"other","label":"Other"}
  ]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.ops_pos_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.ops_pos_settings enable row level security;

drop policy if exists ops_pos_settings_select on public.ops_pos_settings;
create policy ops_pos_settings_select
  on public.ops_pos_settings for select to authenticated
  using (true);

drop policy if exists ops_pos_settings_write on public.ops_pos_settings;
create policy ops_pos_settings_write
  on public.ops_pos_settings for all to authenticated
  using (is_super_admin() or asa_has_grant('finance_write'))
  with check (is_super_admin() or asa_has_grant('finance_write'));

alter table public.compensation_settings
  add column if not exists attendance_present_weight numeric not null default 1,
  add column if not exists attendance_late_weight numeric not null default 0.7,
  add column if not exists pending_floor_optional boolean not null default true,
  add column if not exists cash_advance_auto_deduct boolean not null default false;

comment on column public.compensation_settings.attendance_present_weight is 'Wash-pool weight when attendance status is present';
comment on column public.compensation_settings.attendance_late_weight is 'Wash-pool weight when attendance status is late';
comment on column public.compensation_settings.pending_floor_optional is 'When true, pending floor queue is a reminder not a hard gate';
comment on column public.compensation_settings.cash_advance_auto_deduct is 'When true, approved cash advances deduct on floor payroll preview';
