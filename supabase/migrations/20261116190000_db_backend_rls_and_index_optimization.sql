-- Database & Backend Optimization (2026-11-16):
-- 1) Drop 8 strictly redundant prefix B-tree indexes already covered by composite/unique indexes.
-- 2) Tighten public.notification_broadcasts RLS (Marketing reads customer broadcasts only; SA/ASA own writes/deletes; initplan wrapped).
-- 3) Split promo_vouchers_sa_write (FOR ALL -> INSERT/UPDATE/DELETE) to eliminate redundant permissive SELECT evaluation.

begin;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notification_broadcasts') then
    raise exception 'public.notification_broadcasts is missing — apply prior migrations first';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'promo_vouchers') then
    raise exception 'public.promo_vouchers is missing — apply prior migrations first';
  end if;
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_user_role'
  ) then
    raise exception 'public.current_user_role() is missing — apply prior migrations first';
  end if;
end $$;

-- 1. Drop redundant single/narrow prefix indexes covered by composite B-trees
drop index if exists public.accessory_redemptions_branch_slug_idx;
drop index if exists public.branch_operating_hours_slug_idx;
drop index if exists public.inventory_recon_lines_recon_idx;
drop index if exists public.plan_card_assignees_card_idx;
drop index if exists public.product_branch_stock_branch_product_idx;
drop index if exists public.idx_queue_assignments_booking;
drop index if exists public.idx_queue_assignments_staff;
drop index if exists public.service_size_prices_service_idx;

-- 2. Tighten public.notification_broadcasts RLS (scope marketing to customer broadcasts read-only; SA/ASA write)
drop policy if exists "Only admins manage broadcasts" on public.notification_broadcasts;
drop policy if exists "notification_broadcasts_staff_select" on public.notification_broadcasts;
drop policy if exists "notification_broadcasts_sa_insert" on public.notification_broadcasts;
drop policy if exists "notification_broadcasts_sa_update" on public.notification_broadcasts;
drop policy if exists "notification_broadcasts_sa_delete" on public.notification_broadcasts;

create policy "notification_broadcasts_staff_select"
on public.notification_broadcasts
for select
to authenticated
using (
  (select public.current_user_role()) in ('BossMich', 'assistant_super_admin')
  or ((select public.current_user_role()) = 'marketing' and coalesce(audience_group, 'customers') = 'customers')
);

create policy "notification_broadcasts_sa_insert"
on public.notification_broadcasts
for insert
to authenticated
with check (
  (select public.current_user_role()) in ('BossMich', 'assistant_super_admin')
);

create policy "notification_broadcasts_sa_update"
on public.notification_broadcasts
for update
to authenticated
using (
  (select public.current_user_role()) in ('BossMich', 'assistant_super_admin')
)
with check (
  (select public.current_user_role()) in ('BossMich', 'assistant_super_admin')
);

create policy "notification_broadcasts_sa_delete"
on public.notification_broadcasts
for delete
to authenticated
using (
  (select public.current_user_role()) in ('BossMich', 'assistant_super_admin')
);

-- 3. Remove redundant SELECT evaluation on promo_vouchers caused by FOR ALL policy alongside promo_vouchers_staff_read
drop policy if exists "promo_vouchers_sa_write" on public.promo_vouchers;
drop policy if exists "promo_vouchers_sa_insert" on public.promo_vouchers;
drop policy if exists "promo_vouchers_sa_update" on public.promo_vouchers;
drop policy if exists "promo_vouchers_sa_delete" on public.promo_vouchers;

create policy "promo_vouchers_sa_insert"
on public.promo_vouchers
for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.id = (select auth.uid())
      and sp.is_active = true
      and sp.role in ('BossMich', 'assistant_super_admin')
  )
);

create policy "promo_vouchers_sa_update"
on public.promo_vouchers
for update
to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.id = (select auth.uid())
      and sp.is_active = true
      and sp.role in ('BossMich', 'assistant_super_admin')
  )
)
with check (
  exists (
    select 1 from public.staff_profiles sp
    where sp.id = (select auth.uid())
      and sp.is_active = true
      and sp.role in ('BossMich', 'assistant_super_admin')
  )
);

create policy "promo_vouchers_sa_delete"
on public.promo_vouchers
for delete
to authenticated
using (
  exists (
    select 1 from public.staff_profiles sp
    where sp.id = (select auth.uid())
      and sp.is_active = true
      and sp.role in ('BossMich', 'assistant_super_admin')
  )
);

commit;
