-- Removes everything scripts/seed-september-2026.mjs created. Run as one transaction (Supabase SQL editor or MCP execute_sql).
-- Bookings and customers soft-delete on DELETE, so the tagged rows are removed in replica mode (no triggers);
-- replica mode also skips FK cascades, so children are deleted explicitly first. Staff + auth users go last, with triggers back on.
-- Assumes every bacoor/batangas daily sheet dated 2026-09-01..30 is seed data (the seed refuses to run if any existed).
--
-- BUG-066: replica mode disables the FK triggers, which means a child row does not block its
-- parent and is NOT cascaded either — it is simply left pointing at a row that no longer exists.
-- That is how the September cleanup used to strand POS hand-offs and their transactions. Every
-- referencing table therefore has to be named explicitly here, and the guard at the bottom
-- refuses to commit if any of them still points at a seed booking.
begin;

create temp table seed_sheets on commit drop as
  select id from public.daily_sheets
  where branch in ('bacoor', 'batangas') and business_date between '2026-09-01' and '2026-09-30';
create temp table seed_bookings on commit drop as
  select id from public.bookings where notes like '[seed:sep2026]%';
create temp table seed_handoffs on commit drop as
  select id from public.pos_handoffs where booking_id in (select id from seed_bookings);
-- A sale or a transaction reaches a seed booking either directly or through its hand-off, so both
-- paths are taken. Matching on the relationship as well as the `[seed:sep2026]` tag means a row the
-- seed failed to tag is still recognised as residue instead of being silently orphaned.
create temp table seed_sales on commit drop as
  select id from public.sales
  where notes like '[seed:sep2026]%'
     or booking_id in (select id from seed_bookings)
     or pos_handoff_id in (select id from seed_handoffs);
create temp table seed_transactions on commit drop as
  select id from public.transactions
  where booking_id in (select id from seed_bookings)
     or pos_handoff_id in (select id from seed_handoffs);

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
-- Money first, then the hand-off that points at it, then the booking they both point at.
delete from public.transactions where id in (select id from seed_transactions);
delete from public.pos_handoffs where id in (select id from seed_handoffs);
delete from public.bookings where id in (select id from seed_bookings);

delete from public.staff_attendance where notes like '[seed:sep2026]%';
delete from public.vehicles where plate_number ~ '^ZZ[BT][0-9]{4}$';
delete from public.customers where email like '%@sep2026.hakum.test';

set local session_replication_role = origin;

delete from public.staff_profiles where login_email like '%@seed.hakum.test';
delete from auth.users where email like '%@seed.hakum.test';

-- A committed cleanup that stranded rows is worse than one that refused: the seed rows are gone
-- either way, and the orphans are then invisible to every later "does this booking still resolve"
-- check. Refuse instead, so the whole transaction rolls back.
do $$
declare stranded_handoffs bigint;
declare stranded_transactions bigint;
declare stranded_sales bigint;
begin
  select count(*) into stranded_handoffs
  from public.pos_handoffs
  where booking_id in (select id from seed_bookings);
  select count(*) into stranded_transactions
  from public.transactions
  where booking_id in (select id from seed_bookings)
     or pos_handoff_id in (select id from seed_handoffs);
  select count(*) into stranded_sales
  from public.sales
  where booking_id in (select id from seed_bookings)
     or pos_handoff_id in (select id from seed_handoffs);
  if stranded_handoffs > 0 or stranded_transactions > 0 or stranded_sales > 0 then
    raise exception
      'Cleanup would leave % stranded POS hand-off(s), % stranded transaction(s) and % stranded sale(s) pointing at deleted seed bookings. Rolling back.',
      stranded_handoffs, stranded_transactions, stranded_sales;
  end if;
end $$;

select
  (select count(*) from public.bookings where notes like '[seed:sep2026]%') as bookings_left,
  (select count(*) from public.sales where id in (select id from seed_sales)) as sales_left,
  (select count(*) from public.customers where email like '%@sep2026.hakum.test') as customers_left,
  (select count(*) from public.daily_sheets where branch in ('bacoor', 'batangas') and business_date between '2026-09-01' and '2026-09-30') as sheets_left,
  (select count(*) from public.pos_handoffs where booking_id in (select id from seed_bookings)) as stranded_handoffs_left,
  (select count(*) from public.transactions where booking_id in (select id from seed_bookings) or pos_handoff_id in (select id from seed_handoffs)) as stranded_transactions_left;
commit;
