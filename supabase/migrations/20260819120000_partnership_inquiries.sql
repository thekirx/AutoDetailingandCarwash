-- Inquiries inbox: partnership, contact, and complaints.
--
-- Goal: every inquiry record is readable ONLY by Super Admin ('BossMich') and
-- Assistant Super Admin. Branch admins ('admin'), team leads, and marketing must
-- not be able to read any of the three tables. Public/anonymous INSERT stays open
-- so the website forms keep working.
--
-- NOTE: public.is_admin() in production resolves to
--   ('admin', 'BossMich', 'assistant_super_admin')
-- so it is deliberately NOT used here — it would let branch admins read.

-- ---------------------------------------------------------------------------
-- 1. Shared access rule
-- ---------------------------------------------------------------------------
create or replace function public.is_inquiry_reader()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.current_user_role() in ('BossMich', 'assistant_super_admin');
$$;

revoke all on function public.is_inquiry_reader() from public;
grant execute on function public.is_inquiry_reader() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. New table: partnership_inquiries
-- ---------------------------------------------------------------------------
create table if not exists public.partnership_inquiries (
  id uuid primary key default gen_random_uuid(),
  site_type text not null,
  name text not null,
  email text not null,
  contact_number text not null,
  city text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint partnership_inquiries_site_type_check
    check (site_type in ('commercial_lot', 'mall_retail', 'fuel_station', 'village_condo')),
  constraint partnership_inquiries_status_check
    check (status in ('new', 'reviewing', 'contacted', 'archived'))
);

create index if not exists partnership_inquiries_created_at_idx
  on public.partnership_inquiries (created_at desc);

alter table public.partnership_inquiries enable row level security;

drop policy if exists "Anon insert partnership" on public.partnership_inquiries;
create policy "Anon insert partnership" on public.partnership_inquiries
  for insert to anon, authenticated with check (true);

drop policy if exists "Super admins read partnership" on public.partnership_inquiries;
create policy "Super admins read partnership" on public.partnership_inquiries
  for select to authenticated using (public.is_inquiry_reader());

drop policy if exists "Super admins update partnership" on public.partnership_inquiries;
create policy "Super admins update partnership" on public.partnership_inquiries
  for update to authenticated
  using (public.is_inquiry_reader())
  with check (public.is_inquiry_reader());

revoke all on public.partnership_inquiries from anon, authenticated;
grant insert on public.partnership_inquiries to anon, authenticated;
grant select, update on public.partnership_inquiries to authenticated;

-- ---------------------------------------------------------------------------
-- 3. contact_inquiries — replace admin-wide read with strict read
-- ---------------------------------------------------------------------------
-- Was: for select using ((select public.is_admin()))  -- included branch admins.
drop policy if exists "Admins read contact" on public.contact_inquiries;
drop policy if exists "Super admins read contact" on public.contact_inquiries;
create policy "Super admins read contact" on public.contact_inquiries
  for select to authenticated using (public.is_inquiry_reader());

-- Public contact form must keep working.
drop policy if exists "Anon insert contact" on public.contact_inquiries;
create policy "Anon insert contact" on public.contact_inquiries
  for insert to anon, authenticated with check (true);

revoke all on public.contact_inquiries from anon, authenticated;
grant insert on public.contact_inquiries to anon, authenticated;
grant select on public.contact_inquiries to authenticated;

-- ---------------------------------------------------------------------------
-- 4. complaints — replace staff-wide read with strict read
-- ---------------------------------------------------------------------------
-- Was: for select using (
--        is_admin()
--        OR current_user_role() = 'marketing'
--        OR (current_user_role() = 'team_lead' AND branch = current_user_branch())
--      )
drop policy if exists "Staff read complaints" on public.complaints;
drop policy if exists "Super admins read complaints" on public.complaints;
create policy "Super admins read complaints" on public.complaints
  for select to authenticated using (public.is_inquiry_reader());

-- Public complaint form must keep working.
drop policy if exists "Anon insert complaints" on public.complaints;
create policy "Anon insert complaints" on public.complaints
  for insert to anon, authenticated with check (true);

revoke all on public.complaints from anon, authenticated;
grant insert on public.complaints to anon, authenticated;
grant select, update on public.complaints to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Result
-- ---------------------------------------------------------------------------
-- partnership_inquiries : anon INSERT | SA + ASA SELECT/UPDATE
-- contact_inquiries     : anon INSERT | SA + ASA SELECT
-- complaints            : anon INSERT | SA + ASA SELECT/UPDATE
-- All other roles (admin, team_lead, marketing, staff, sales, ...) read nothing.
