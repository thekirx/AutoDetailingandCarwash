-- Hakum Auto Care: enforce soft deletion for services.
-- Apply through `supabase db push` or run this file in the Supabase SQL Editor.

begin;

alter table public.services
add column if not exists is_archived boolean not null default false;

drop trigger if exists services_soft_delete on public.services;
create trigger services_soft_delete
before delete on public.services
for each row execute function public.archive_instead_of_delete();

drop policy if exists "Public can view active services" on public.services;
create policy "Public can view active services"
on public.services for select
to anon, authenticated
using (is_active = true and is_archived = false);

drop policy if exists "Staff can archive services" on public.services;
revoke delete on public.services from authenticated;

commit;
