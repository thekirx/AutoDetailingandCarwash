-- Contact inbox workflow: same status CHECK as partnership inquiries,
-- plus UPDATE for SA/ASA readers. Missing ASA grant keys stay default-true
-- in public.asa_has_grant (except finance_write / planning_edit / rbac_edit).

alter table public.contact_inquiries
  add column if not exists status text;

update public.contact_inquiries
set status = 'new'
where status is null or btrim(status) = '';

alter table public.contact_inquiries
  alter column status set default 'new';

alter table public.contact_inquiries
  alter column status set not null;

alter table public.contact_inquiries
  drop constraint if exists contact_inquiries_status_check;

alter table public.contact_inquiries
  add constraint contact_inquiries_status_check
  check (status in ('new', 'reviewing', 'contacted', 'archived'));

create index if not exists contact_inquiries_status_created_at_idx
  on public.contact_inquiries (status, created_at desc);

drop policy if exists "Super admins update contact" on public.contact_inquiries;
create policy "Super admins update contact" on public.contact_inquiries
  for update to authenticated
  using (public.is_inquiry_reader())
  with check (public.is_inquiry_reader());

revoke all on public.contact_inquiries from anon, authenticated;
grant insert on public.contact_inquiries to anon, authenticated;
grant select, update on public.contact_inquiries to authenticated;
