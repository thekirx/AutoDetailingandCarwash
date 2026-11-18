-- =============================================================================
-- Multi-month scale indexes (June 2025 – November 2026+ full-timeline workload)
-- =============================================================================
-- Covers hot multi-month read paths identified in the deep database & workflow audit:
--   1. public.payslips (staff_id, period_start desc) — /operations/payslips (MyPayslipsPage)
--      and FK lookups on staff_profiles(id).
--   2. public.payslips (period_start desc) — /operations/payroll (MonthlyPayrollPage)
--      all-branch payroll history ordered by period_start desc.
--   3. public.daily_sheets (business_date desc) — /operations/finance?tab=sheets
--      all-branch / all-status date-range scans ordered by business_date desc.
--   4. public.customer_memberships (customer_id) where is_active = true —
--      CRM active membership tier lookup across > 1,000 customer rows.

begin;

do $$
begin
  if to_regclass('public.payslips') is null
     or to_regclass('public.daily_sheets') is null
     or to_regclass('public.customer_memberships') is null then
    raise exception 'Required tables (payslips, daily_sheets, customer_memberships) must exist before creating multi-month scale indexes';
  end if;
end
$$;

create index if not exists payslips_staff_period_idx
  on public.payslips (staff_id, period_start desc);

create index if not exists payslips_period_start_idx
  on public.payslips (period_start desc);

create index if not exists daily_sheets_business_date_desc_idx
  on public.daily_sheets (business_date desc);

create index if not exists customer_memberships_active_customer_idx
  on public.customer_memberships (customer_id)
  where is_active = true;

commit;
