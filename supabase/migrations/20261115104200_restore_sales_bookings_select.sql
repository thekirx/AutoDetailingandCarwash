-- Restore all-branch SELECT visibility on public.bookings for 'sales' (Customer Rep).
-- 20261108200000_multi_branch_customer_notes.sql replaced `current_user_role() = 'sales'`
-- with `is_staff()`, which does not include `'sales'`, inadvertently hiding bookings from Sales.
-- Writes (INSERT/UPDATE/DELETE) on bookings remain locked for Sales.

DROP POLICY IF EXISTS bookings_select ON public.bookings;
CREATE POLICY bookings_select ON public.bookings
  FOR SELECT TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR (SELECT public.is_staff())
    OR (SELECT public.current_user_role()) = 'sales'
    OR (
      (SELECT public.current_user_role()) IN ('detailer', 'marketing')
      AND branch = ANY ((SELECT public.accessible_branch_slugs())::text[])
    )
    OR branch = ANY ((SELECT public.manageable_branch_slugs())::text[])
    OR public.staff_is_assigned_to_booking(id)
  );
