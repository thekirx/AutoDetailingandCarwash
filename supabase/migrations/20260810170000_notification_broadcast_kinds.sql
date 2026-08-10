-- Admin-managed broadcast kinds (Promo / We missed you / …) for SA/ASA CRUD.

begin;

create table if not exists public.notification_broadcast_kinds (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  description text,
  default_title text,
  default_body text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_broadcast_kinds_slug_ck
    check (slug ~ '^[a-z][a-z0-9_]{1,47}$'),
  constraint notification_broadcast_kinds_label_len
    check (char_length(label) between 1 and 64),
  constraint notification_broadcast_kinds_title_len
    check (default_title is null or char_length(default_title) <= 160),
  constraint notification_broadcast_kinds_body_len
    check (default_body is null or char_length(default_body) <= 1000)
);

create unique index if not exists notification_broadcast_kinds_slug_uidx
  on public.notification_broadcast_kinds (slug);

create index if not exists notification_broadcast_kinds_active_order_idx
  on public.notification_broadcast_kinds (is_active, display_order, label);

alter table public.notification_broadcast_kinds enable row level security;

-- Staff read active kinds in-app; writes go through service-role API.
drop policy if exists notification_broadcast_kinds_staff_read on public.notification_broadcast_kinds;
create policy notification_broadcast_kinds_staff_read
  on public.notification_broadcast_kinds
  for select
  to authenticated
  using (
    is_active = true
    or exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin', 'marketing')
    )
  );

insert into public.notification_broadcast_kinds (slug, label, description, default_title, default_body, display_order)
values
  (
    'promo',
    'Promo',
    'Deals and limited offers',
    'Hakum Auto Care: Special offer',
    'Hi {name}, check our latest promo at hakumautocare.com/book.',
    10
  ),
  (
    'we_missed',
    'We missed you',
    'Win-back for quiet customers',
    'Hakum Auto Care: We miss you',
    'Hi {name}, it has been a while. Book your next visit at hakumautocare.com/book.',
    20
  ),
  (
    'reminder',
    'Reminder',
    'Manual one-off reminder',
    'Hakum Auto Care: Friendly reminder',
    'Hi {name}, {plate} may be due for service. Book at hakumautocare.com/book.',
    30
  ),
  (
    'custom',
    'Custom',
    'Free-form broadcast',
    null,
    null,
    40
  )
on conflict (slug) do nothing;

commit;
