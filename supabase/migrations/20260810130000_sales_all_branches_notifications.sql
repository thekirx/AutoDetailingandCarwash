-- Sales: assigned to all branches — read every booking, assign to any branch on insert/update.
-- Status writes still go through /api/booking-status (service role); RLS just allows the row access.

begin;

drop policy if exists "Sales can read all bookings" on public.bookings;
create policy "Sales can read all bookings"
on public.bookings
for select
to authenticated
using (public.current_user_role() = 'sales');

drop policy if exists "Sales can insert bookings for any branch" on public.bookings;
create policy "Sales can insert bookings for any branch"
on public.bookings
for insert
to authenticated
with check (
  public.current_user_role() = 'sales'
  and status::text in ('pending', 'confirmed')
);

drop policy if exists "Sales can update bookings across branches" on public.bookings;
create policy "Sales can update bookings across branches"
on public.bookings
for update
to authenticated
using (
  public.current_user_role() = 'sales'
  and status::text in (
    'pending',
    'confirmed',
    'waiting',
    'in_progress',
    'final_checking',
    'completed',
    'cancelled'
  )
)
with check (
  public.current_user_role() = 'sales'
  and status::text in (
    'pending',
    'confirmed',
    'waiting',
    'in_progress',
    'final_checking',
    'completed',
    'cancelled'
  )
);

commit;

-- Notification reminder settings: Super Admin / ASA configure per-service reminders.
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete cascade,
  branch_slug text references public.branches(slug) on delete cascade,
  channel text not null default 'push' check (channel in ('push', 'sms', 'both')),
  frequency_months int not null default 6 check (frequency_months between 1 and 24),
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, branch_slug)
);

create index if not exists notification_settings_service_idx
  on public.notification_settings (service_id)
  where enabled;

create index if not exists notification_settings_branch_idx
  on public.notification_settings (branch_slug);

alter table public.notification_settings enable row level security;

drop policy if exists "Only admins manage notification settings" on public.notification_settings;
create policy "Only admins manage notification settings"
on public.notification_settings
for all
to authenticated
using (
  public.current_user_role() in ('BossMich', 'assistant_super_admin')
)
with check (
  public.current_user_role() in ('BossMich', 'assistant_super_admin')
);

-- Broadcast log: marketing / reminder pushes sent to all customers (or filtered).
create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'promo' check (kind in ('promo', 'reminder', 'we_missed', 'custom')),
  channel text not null default 'push' check (channel in ('push', 'sms', 'both')),
  title text not null,
  body text,
  url text,
  target_audience text not null default 'all' check (target_audience in ('all', 'detailing', 'wash', 'branch')),
  branch_slug text references public.branches(slug) on delete set null,
  sent_count int not null default 0,
  failed_count int not null default 0,
  sent_by uuid references auth.users(id),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists notification_broadcasts_kind_idx
  on public.notification_broadcasts (kind, sent_at desc);

alter table public.notification_broadcasts enable row level security;

drop policy if exists "Only admins manage broadcasts" on public.notification_broadcasts;
create policy "Only admins manage broadcasts"
on public.notification_broadcasts
for all
to authenticated
using (
  public.current_user_role() in ('BossMich', 'assistant_super_admin', 'marketing')
)
with check (
  public.current_user_role() in ('BossMich', 'assistant_super_admin', 'marketing')
);

commit;
