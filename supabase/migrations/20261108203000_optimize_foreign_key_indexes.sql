-- 20261108203000_optimize_foreign_key_indexes.sql
-- Database Optimization: Add covering indexes on unindexed Foreign Keys
-- Complies with Supabase Postgres Best Practices (schema-foreign-key-indexes).
-- Speeds up JOIN queries and eliminates sequential table scans during cascade operations.

begin;

create index if not exists bookings_promo_applied_by_idx
  on public.bookings (promo_applied_by);

create index if not exists bookings_referred_by_staff_id_idx
  on public.bookings (referred_by_staff_id);

create index if not exists tint_finder_leads_branch_idx
  on public.tint_finder_leads (branch);

create index if not exists referral_credits_applied_booking_id_idx
  on public.referral_credits (applied_booking_id);

create index if not exists accessory_redemptions_branch_slug_idx
  on public.accessory_redemptions (branch_slug);

create index if not exists accessory_redemptions_fulfilled_by_idx
  on public.accessory_redemptions (fulfilled_by);

create index if not exists accessory_redemptions_product_id_idx
  on public.accessory_redemptions (product_id);

create index if not exists promo_vouchers_created_by_idx
  on public.promo_vouchers (created_by);

create index if not exists promo_voucher_redemptions_applied_by_idx
  on public.promo_voucher_redemptions (applied_by);

create index if not exists promo_voucher_redemptions_customer_id_idx
  on public.promo_voucher_redemptions (customer_id);

create index if not exists promo_voucher_redemptions_voucher_id_idx
  on public.promo_voucher_redemptions (voucher_id);

create index if not exists restock_requests_product_id_idx
  on public.restock_requests (product_id);

-- Refresh statistics for query planner
analyze public.bookings;
analyze public.tint_finder_leads;
analyze public.referral_credits;
analyze public.accessory_redemptions;
analyze public.promo_vouchers;
analyze public.promo_voucher_redemptions;
analyze public.restock_requests;

commit;

