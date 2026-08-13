-- Hot path: paid sales by branch + occurred_at (floor, POS, CRM, compensation).
-- Partial index matches that filter (postgres-best-practices query-partial-indexes).
create index if not exists sales_paid_branch_occurred_idx
  on public.sales (branch, occurred_at desc)
  where status = 'paid';

-- Advisor: identical duplicates.
drop index if exists public.idx_bookings_vehicle_plate;
drop index if exists public.sales_customer_occurred_idx;
