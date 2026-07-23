-- Global app settings (SMS automation toggle, etc.)
begin;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('sms_notifications', jsonb_build_object('enabled', true))
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "Anyone authenticated can read app_settings" on public.app_settings;
create policy "Anyone authenticated can read app_settings"
on public.app_settings for select to authenticated
using (true);

drop policy if exists "Admins write app_settings" on public.app_settings;
create policy "Admins write app_settings"
on public.app_settings for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.app_settings to authenticated;
grant insert, update on public.app_settings to authenticated;

commit;
