-- Partial indexes on nullable sale foreign keys added in 20261018120000_refer_a_friend.sql
-- Keeps FK checks/deletes fast without bloating index size when NULL.
CREATE INDEX IF NOT EXISTS idx_customer_referrals_qualifying_sale_id
  ON public.customer_referrals (qualifying_sale_id)
  WHERE qualifying_sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_referral_rewards_claimed_sale_id
  ON public.customer_referral_rewards (claimed_sale_id)
  WHERE claimed_sale_id IS NOT NULL;
