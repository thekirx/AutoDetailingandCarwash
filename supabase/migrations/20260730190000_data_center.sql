-- Super Admin Data Center: owner-controlled export/import/delete trail + backup reminders
-- Platform PITR remains in Supabase Dashboard; this table records Hakum-side permanence actions.

create table if not exists public.data_center_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in (
    'export',
    'import',
    'purge',
    'archive',
    'backup_ack',
    'reminder_snooze'
  )),
  summary text not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists data_center_events_created_at_idx
  on public.data_center_events (created_at desc);

create table if not exists public.data_center_settings (
  id int primary key default 1 check (id = 1),
  last_export_at timestamptz,
  last_import_at timestamptz,
  last_purge_at timestamptz,
  last_platform_backup_ack_at timestamptz,
  reminder_days int not null default 7 check (reminder_days between 1 and 90),
  snooze_until timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.data_center_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.data_center_events enable row level security;
alter table public.data_center_settings enable row level security;

drop policy if exists "SA read data center events" on public.data_center_events;
create policy "SA read data center events"
  on public.data_center_events for select to authenticated
  using (public.current_user_role() = 'BossMich');

drop policy if exists "SA insert data center events" on public.data_center_events;
create policy "SA insert data center events"
  on public.data_center_events for insert to authenticated
  with check (public.current_user_role() = 'BossMich');

drop policy if exists "SA read data center settings" on public.data_center_settings;
create policy "SA read data center settings"
  on public.data_center_settings for select to authenticated
  using (public.current_user_role() = 'BossMich');

drop policy if exists "SA update data center settings" on public.data_center_settings;
create policy "SA update data center settings"
  on public.data_center_settings for update to authenticated
  using (public.current_user_role() = 'BossMich')
  with check (public.current_user_role() = 'BossMich');

revoke all on public.data_center_events from anon, public;
revoke all on public.data_center_settings from anon, public;
grant select, insert on public.data_center_events to authenticated;
grant select, update on public.data_center_settings to authenticated;
-- service role used by API for full export/import
grant all on public.data_center_events to service_role;
grant all on public.data_center_settings to service_role;
