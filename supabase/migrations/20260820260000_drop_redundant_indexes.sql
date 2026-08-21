-- OPT-08: drop only proven-redundant indexes (same leading keys as a unique/better index).
-- Do NOT drop zero-scan FK indexes that are still young / unused by workload.

-- Exact non-unique duplicate of UNIQUE(slug)
drop index if exists public.events_slug_idx;

-- Exact non-unique duplicate of UNIQUE(sale_id)
drop index if exists public.payroll_run_sales_sale_idx;

-- Full (branch, queue_date, queue_number) superseded by partial active-floor index
drop index if exists public.idx_bookings_branch_queue_date_number;

-- Full customer_id superseded by partial active + (customer_id, created_at) indexes
drop index if exists public.idx_bookings_customer_id;

-- vehicle_id alone superseded by (vehicle_id, created_at) leftmost prefix
drop index if exists public.idx_bookings_vehicle_id;

-- booking_id alone superseded by partial unique on non-null booking_id
drop index if exists public.service_reviews_booking_idx;

-- (staff_id, attendance_date DESC) superseded by UNIQUE(staff_id, attendance_date)
drop index if exists public.staff_attendance_staff_date_idx;
