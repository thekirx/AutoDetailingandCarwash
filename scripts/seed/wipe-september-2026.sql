-- Removes everything scripts/seed-september-2026.mjs created. Run as one transaction (Supabase SQL editor or MCP execute_sql).
-- Bookings and customers soft-delete on DELETE, so the tagged rows are removed in replica mode (no triggers);
-- replica mode also skips FK cascades, so children are deleted explicitly first. Staff + auth users go last, with triggers back on.
-- Assumes every bacoor/batangas daily sheet dated 2026-09-01..30 is seed data (the seed refuses to run if any existed).
begin;

create temp table seed_sheets on commit drop as
  select id from public.daily_sheets
  where branch in ('bacoor', 'batangas') and business_date between '2026-09-01' and '2026-09-30';
create temp table seed_bookings on commit drop as
  select id from public.bookings where notes like '[seed:sep2026]%';
create temp table seed_sales on commit drop as
  select id from public.sales where notes like '[seed:sep2026]%';

set local session_replication_role = replica;

delete from public.expenses where daily_sheet_line_id in (select l.id from public.daily_sheet_lines l where l.sheet_id in (select id from seed_sheets));
delete from public.audit_logs where entity_type = 'daily_sheets' and entity_id in (select id::text from seed_sheets);
delete from public.daily_sheet_lines where sheet_id in (select id from seed_sheets);
delete from public.daily_sheets where id in (select id from seed_sheets);
delete from public.expenses where description like '[seed:sep2026]%';

delete from public.sale_line_items where sale_id in (select id from seed_sales);
delete from public.loyalty_ledger where sale_id in (select id from seed_sales);
delete from public.sales where id in (select id from seed_sales);

delete from public.queue_events where booking_id in (select id from seed_bookings);
delete from public.queue_assignments where booking_id in (select id from seed_bookings);
delete from public.sms_events where booking_id in (select id from seed_bookings);
delete from public.vehicle_maintenance_schedules where notes like '[seed:sep2026]%';
delete from public.bookings where id in (select id from seed_bookings);

delete from public.staff_attendance where notes like '[seed:sep2026]%';
delete from public.vehicles where plate_number ~ '^ZZ[BT][0-9]{4}$';
delete from public.customers where email like '%@sep2026.hakum.test';

set local session_replication_role = origin;

delete from public.staff_profiles where login_email like '%@seed.hakum.test';
delete from auth.users where email like '%@seed.hakum.test';

select
  (select count(*) from public.bookings where notes like '[seed:sep2026]%') as bookings_left,
  (select count(*) from public.sales where notes like '[seed:sep2026]%') as sales_left,
  (select count(*) from public.customers where email like '%@sep2026.hakum.test') as customers_left,
  (select count(*) from public.daily_sheets where branch in ('bacoor', 'batangas') and business_date between '2026-09-01' and '2026-09-30') as sheets_left;
commit;
