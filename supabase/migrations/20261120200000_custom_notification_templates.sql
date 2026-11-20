-- Migration: Support custom notification templates with label, category, description, and channel
begin;

alter table public.notification_templates
  add column if not exists label text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists channel text default 'both',
  add column if not exists is_custom boolean not null default false;

drop policy if exists notification_templates_staff_write on public.notification_templates;
create policy notification_templates_staff_write
  on public.notification_templates
  for all
  to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  );

grant all on public.notification_templates to authenticated;

commit;
