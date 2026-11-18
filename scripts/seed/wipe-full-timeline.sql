-- Removes everything scripts/seed-full-timeline.mjs created ([seed:jun2025-nov2026]).
-- Run as one transaction (Supabase SQL editor).
-- Never touches [seed:sep2026] rows or live user rows.

begin;

create temp table ft_seed_sheets on commit drop as
  select id from public.daily_sheets
  where notes like '%[seed:jun2025-nov2026]%';

create temp table ft_seed_bookings on commit drop as
  select id from public.bookings
  where notes like '%[seed:jun2025-nov2026]%';

create temp table ft_seed_sales on commit drop as
  select id from public.sales
  where notes like '%[seed:jun2025-nov2026]%'
     or booking_id in (select id from ft_seed_bookings);

create temp table ft_seed_customers on commit drop as
  select id from public.customers
  where email like '%@seed.hakumautocare.local';

create temp table ft_seed_cards on commit drop as
  select id from public.plan_cards
  where description like '%[seed:jun2025-nov2026]%';

create temp table ft_seed_recons on commit drop as
  select id from public.inventory_recons
  where notes like '%[seed:jun2025-nov2026]%';

set local session_replication_role = replica;

delete from public.expenses
where description like '%[seed:jun2025-nov2026]%'
   or daily_sheet_line_id in (
     select l.id from public.daily_sheet_lines l where l.sheet_id in (select id from ft_seed_sheets)
   );
delete from public.daily_sheet_lines where sheet_id in (select id from ft_seed_sheets);
delete from public.daily_sheets where id in (select id from ft_seed_sheets);

delete from public.payslips where note like '%[seed:jun2025-nov2026]%';
delete from public.payroll_period_locks
where id in (
  select l.id from public.payroll_period_locks l
  where not exists (select 1 from public.payslips p where p.period_start = l.period_start and p.period_end = l.period_end and p.branch = l.branch)
);

delete from public.sale_line_items where sale_id in (select id from ft_seed_sales);
delete from public.loyalty_ledger where sale_id in (select id from ft_seed_sales) or reason like '%[seed:jun2025-nov2026]%';
delete from public.sales where id in (select id from ft_seed_sales);

delete from public.service_reviews where comment like '%[seed:jun2025-nov2026]%';
delete from public.queue_events where booking_id in (select id from ft_seed_bookings);
delete from public.queue_assignments where booking_id in (select id from ft_seed_bookings);
delete from public.vehicle_maintenance_schedules where notes like '%[seed:jun2025-nov2026]%';
delete from public.bookings where id in (select id from ft_seed_bookings);

delete from public.staff_attendance where notes like '%[seed:jun2025-nov2026]%';
delete from public.complaints where description like '%[seed:jun2025-nov2026]%';
delete from public.accessory_redemptions where pickup_code like 'FT-PK%';
delete from public.promo_voucher_redemptions where id::text like '00202611-%';
delete from public.product_stock_movements where reason like '%[seed:jun2025-nov2026]%';
delete from public.vendors where notes like '%[seed:jun2025-nov2026]%';
delete from public.plan_card_assignees where card_id in (select id from ft_seed_cards);
delete from public.plan_cards where id in (select id from ft_seed_cards);
delete from public.ops_form_submissions where payload::text like '%[seed:jun2025-nov2026]%';
delete from public.contact_inquiries where message like '%[seed:jun2025-nov2026]%';
delete from public.inventory_recon_lines where recon_id in (select id from ft_seed_recons);
delete from public.inventory_recons where id in (select id from ft_seed_recons);
delete from public.notification_broadcasts where body like '%[seed:jun2025-nov2026]%';

delete from public.customer_referral_rewards where customer_id in (select id from ft_seed_customers);
delete from public.customer_referrals where referrer_id in (select id from ft_seed_customers) or friend_id in (select id from ft_seed_customers);
delete from public.customer_birthday_perks where customer_id in (select id from ft_seed_customers);
delete from public.customer_notes where body like '%[seed:jun2025-nov2026]%';
delete from public.customer_memberships where customer_id in (select id from ft_seed_customers);
delete from public.vehicles where customer_id in (select id from ft_seed_customers) or plate_number ~ '^FT[CT][0-9]{4}$';
delete from public.customers where id in (select id from ft_seed_customers);

set local session_replication_role = origin;

commit;
