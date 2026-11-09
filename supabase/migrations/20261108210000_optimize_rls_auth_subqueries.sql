-- Migration: 20261108210000_optimize_rls_auth_subqueries.sql
-- Optimizes remaining RLS policies using bare auth.uid() by wrapping them in scalar subqueries (SELECT auth.uid()).
-- This ensures Postgres evaluates auth.uid() once per query instead of per row, eliminating N+1 CPU overhead.

-- 1. payslips
DROP POLICY IF EXISTS payslips_select ON public.payslips;
CREATE POLICY payslips_select ON public.payslips
  FOR SELECT
  TO authenticated
  USING (
    staff_id = (SELECT auth.uid())
    OR is_super_admin()
    OR (current_user_role() = 'assistant_super_admin' AND asa_has_grant('finance_write'))
  );

-- 2. restock_requests
DROP POLICY IF EXISTS restock_requests_select ON public.restock_requests;
CREATE POLICY restock_requests_select ON public.restock_requests
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR requested_by = (SELECT auth.uid())
    OR current_user_role() = 'assistant_super_admin'
    OR (current_user_role() = 'admin' AND user_has_branch_access(branch_slug))
  );

-- 3. accessory_redemptions
DROP POLICY IF EXISTS accessory_redemptions_select ON public.accessory_redemptions;
CREATE POLICY accessory_redemptions_select ON public.accessory_redemptions
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
  );

-- 4. referral_credits
DROP POLICY IF EXISTS referral_credits_select ON public.referral_credits;
CREATE POLICY referral_credits_select ON public.referral_credits
  FOR SELECT
  TO authenticated
  USING (
    referrer_customer_id = (SELECT auth.uid())
    OR is_staff()
  );

-- 5, 6, 7. promo_vouchers
DROP POLICY IF EXISTS promo_vouchers_staff_read ON public.promo_vouchers;
CREATE POLICY promo_vouchers_staff_read ON public.promo_vouchers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = (SELECT auth.uid())
        AND sp.is_active = true
    )
  );

DROP POLICY IF EXISTS promo_vouchers_customer_read ON public.promo_vouchers;
CREATE POLICY promo_vouchers_customer_read ON public.promo_vouchers
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = (SELECT auth.uid())
        AND COALESCE(c.is_archived, false) = false
    )
  );

DROP POLICY IF EXISTS promo_vouchers_sa_write ON public.promo_vouchers;
CREATE POLICY promo_vouchers_sa_write ON public.promo_vouchers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = (SELECT auth.uid())
        AND sp.is_active = true
        AND sp.role IN ('BossMich', 'assistant_super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = (SELECT auth.uid())
        AND sp.is_active = true
        AND sp.role IN ('BossMich', 'assistant_super_admin')
    )
  );

-- 8, 9. promo_voucher_redemptions
DROP POLICY IF EXISTS promo_voucher_redemptions_staff_read ON public.promo_voucher_redemptions;
CREATE POLICY promo_voucher_redemptions_staff_read ON public.promo_voucher_redemptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = (SELECT auth.uid())
        AND sp.is_active = true
    )
  );

DROP POLICY IF EXISTS promo_voucher_redemptions_own_read ON public.promo_voucher_redemptions;
CREATE POLICY promo_voucher_redemptions_own_read ON public.promo_voucher_redemptions
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
  );

