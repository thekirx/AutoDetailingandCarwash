-- Extend notification templates, broadcasts, and SMS templates for:
-- 1) Explicit BusyBee multi-part SMS opt-in flag (`allow_multipart`, up to 306 chars)
-- 2) Broadcast audience groups (`customers`, `employees`, `both`) & role targeting
-- 3) Relaxed notification_broadcasts.kind check so admin-created kinds succeed
-- 4) Seeded Announcement & Ops Notice broadcast kinds

begin;

alter table public.notification_templates
  add column if not exists allow_multipart boolean not null default false;

alter table public.sms_templates
  add column if not exists allow_multipart boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.notification_broadcasts
  add column if not exists audience_group text not null default 'customers',
  add column if not exists employee_scope text not null default 'all',
  add column if not exists employee_roles text[] not null default '{}'::text[],
  add column if not exists allow_multipart boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.notification_broadcasts
  drop constraint if exists notification_broadcasts_audience_group_ck;
alter table public.notification_broadcasts
  add constraint notification_broadcasts_audience_group_ck
  check (audience_group in ('customers', 'employees', 'both'));

alter table public.notification_broadcasts
  drop constraint if exists notification_broadcasts_employee_scope_ck;
alter table public.notification_broadcasts
  add constraint notification_broadcasts_employee_scope_ck
  check (employee_scope in ('all', 'roles', 'branch'));

alter table public.notification_broadcasts
  drop constraint if exists notification_broadcasts_kind_check;
alter table public.notification_broadcasts
  add constraint notification_broadcasts_kind_check
  check (kind ~ '^[a-z][a-z0-9_]{1,47}$');

insert into public.notification_broadcast_kinds (
  slug, label, description, default_title, default_body, display_order, is_active
)
values
  (
    'announcement',
    'Shop announcement',
    'Operating hours, policy updates, or team-wide notices.',
    'Hakum Auto Care update',
    'Heads up {name}: check our latest schedule and branch updates in the app.',
    15,
    true
  ),
  (
    'ops_notice',
    'Team notice',
    'Internal announcements for employees via In-App Inbox and Web Push.',
    'Team notice',
    'Hi {name}, please review the latest shop announcement in Operations.',
    25,
    true
  )
on conflict (slug) do nothing;

commit;
