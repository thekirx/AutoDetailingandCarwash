-- O-08: homepage wash/detail add-ons missing from Inventory `services`.
-- Glass + Engine active on /services + book; Mobile inactive until SA turns it on.

insert into public.services (
  name,
  slug,
  description,
  price_minor,
  currency,
  duration_minutes,
  is_active,
  display_order,
  is_archived,
  loyalty_weight,
  pay_category
)
values
  (
    'Glass Detailing',
    'glass-detailing',
    'Polished, decontaminated glass for sharper vision in every condition.',
    50000,
    'PHP',
    45,
    true,
    4,
    false,
    1,
    'addon'
  ),
  (
    'Engine Wash',
    'engine-wash',
    'A precise, component-safe clean for a neater engine bay.',
    80000,
    'PHP',
    60,
    true,
    5,
    false,
    1,
    'addon'
  ),
  (
    'Mobile Detailing',
    'mobile-detailing',
    'Premium Hakum car care delivered where it is most convenient.',
    250000,
    'PHP',
    120,
    false,
    8,
    false,
    1,
    'general'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  -- Keep existing price if already edited by SA; only fill description/name/order/category.
  display_order = excluded.display_order,
  pay_category = excluded.pay_category,
  is_archived = false,
  updated_at = clock_timestamp(),
  -- Never force-reactivate Mobile if SA left it off; only force-activate Glass/Engine.
  is_active = case
    when excluded.slug = 'mobile-detailing' then public.services.is_active
    else true
  end;
