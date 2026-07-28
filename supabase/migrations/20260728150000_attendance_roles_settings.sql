-- Attendance roles allow-list: Super Admin CRUD only (strict RLS)
begin;

insert into public.app_settings (key, value, updated_at)
values (
  'attendance_roles',
  jsonb_build_object(
    'roles',
    jsonb_build_array(
      'staff',
      'team_lead',
      'admin',
      'assistant_super_admin',
      'BossMich',
      'marketing'
    )
  ),
  now()
)
on conflict (key) do nothing;

-- Split write policies: admins keep other keys; attendance_roles is BossMich only.
drop policy if exists "Admins write app_settings" on public.app_settings;
drop policy if exists "Admins write non-role app_settings" on public.app_settings;
drop policy if exists "Super admin write attendance_roles" on public.app_settings;

create policy "Admins write non-role app_settings"
on public.app_settings for all to authenticated
using (
  key <> 'attendance_roles'
  and public.is_admin()
)
with check (
  key <> 'attendance_roles'
  and public.is_admin()
);

create policy "Super admin write attendance_roles"
on public.app_settings for all to authenticated
using (
  key = 'attendance_roles'
  and public.is_super_admin()
)
with check (
  key = 'attendance_roles'
  and public.is_super_admin()
);

commit;
