-- Push subscriptions + in-app inbox for PWA / web push (WEB_PUSH_AGENT_PLAYBOOK).
-- sms_events already exists; ensure provider_response column for BusyBee payloads.

begin;

alter table public.sms_events
  add column if not exists provider_response text;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  role text,
  branch_slug text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_role_idx on public.push_subscriptions (role);
create index if not exists push_subscriptions_branch_idx on public.push_subscriptions (branch_slug);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  url text,
  tag text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.user_notifications enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
on public.push_subscriptions
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users read own notifications" on public.user_notifications;
create policy "Users read own notifications"
on public.user_notifications
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users update own notifications" on public.user_notifications;
create policy "Users update own notifications"
on public.user_notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Admins can read inbox for support (optional)
drop policy if exists "Admins read all notifications" on public.user_notifications;
create policy "Admins read all notifications"
on public.user_notifications
for select
to authenticated
using (public.is_admin());

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, update on public.user_notifications to authenticated;

commit;
