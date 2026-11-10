-- Visit-based Loyalty Tiers:
-- 1–29 visits: Hakum Basic Member
-- 30–69 visits: Hakum Deluxe Member
-- 70–99 visits: Hakum Premium Member
-- 100+ visits: Hakum Platinum Member

alter table public.membership_tiers
  add column if not exists min_visits integer not null default 0,
  add column if not exists max_visits integer;

-- Update or insert the 4 visit-based customer loyalty tiers
insert into public.membership_tiers (
  name, min_visits, max_visits, starting_price_minor, discount_percent, loyalty_multiplier, benefits, included_services, is_active
) values
(
  'Hakum Basic Member',
  1,
  29,
  0,
  0,
  1.00,
  array['Welcome tier for all Hakum drivers', 'Accumulate visit stamps and points on every service', 'Standard service scoring'],
  array[]::text[],
  true
),
(
  'Hakum Deluxe Member',
  30,
  69,
  0,
  5,
  1.20,
  array['5% member discount on select services', '1.2x points loyalty multiplier', 'Milestone visit rewards', 'Priority seasonal promos'],
  array[]::text[],
  true
),
(
  'Hakum Premium Member',
  70,
  99,
  0,
  10,
  1.50,
  array['10% member discount on detailing & wash', '1.5x points loyalty multiplier', 'Priority bay queueing', 'Anniversary perks'],
  array[]::text[],
  true
),
(
  'Hakum Platinum Member',
  100,
  null,
  0,
  15,
  2.00,
  array['15% VIP member discount on all services', '2.0x points loyalty multiplier', 'VIP priority queueing', 'Exclusive merchandise access', 'Complimentary annual perk'],
  array['Premium Car Wash']::text[],
  true
)
on conflict (name) do update set
  min_visits = excluded.min_visits,
  max_visits = excluded.max_visits,
  discount_percent = excluded.discount_percent,
  loyalty_multiplier = excluded.loyalty_multiplier,
  benefits = excluded.benefits,
  included_services = excluded.included_services,
  is_active = excluded.is_active;

-- Remove legacy single 'Platinum' ₱9,999 row if present
delete from public.membership_tiers where name = 'Platinum' and starting_price_minor = 999900;
