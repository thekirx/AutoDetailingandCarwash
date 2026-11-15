-- Apply real master catalog for Hakum Auto Care:
-- 1) 33 real services + Small/Medium/Large/Extra Large service_size_prices (Motorcycle L/XL omitted as N/A).
-- 2) 6 Coffee Menu drinks with Iced/Hot variants + 5 real Sellables + Points Shop Hakum Keychain + Coffee Materials/Chemicals.
-- 3) Legacy/demo rows safely archived (preserving all historical bookings, sales, and ledger FKs).
-- 4) Ensure product_branch_stock rows exist across active operational branches for POS & customer claiming.

BEGIN;

-- Ensure branches coming-soon flags stay explicit for Dasmariñas & Imus
UPDATE public.branches
SET coming_soon = true, is_active = false, is_public = true, is_archived = false, updated_at = now()
WHERE slug IN ('dasmarinas', 'imus');

-- 1. Upsert canonical 33 real services (parent_service_id cleared so all 33 are top-level selectable services)
WITH master_services (
  slug, name, pay_category, duration_minutes, display_order,
  points_award, referral_eligible, s_minor, m_minor, l_minor, xl_minor
) AS (
  VALUES
    -- Detailing, PPF & Nano Ceramic Tint (12)
    ('ultimate-ceramic-coating',            'Ultimate Ceramic Coating',             'detailing', 480, 1,  15, true,  1650000,  1950000,  2150000,  2400000),
    ('platinum-ceramic-coating',            'Platinum Ceramic Coating',             'detailing', 480, 2,  15, true,  2000000,  2350000,  2550000,  2800000),
    ('ceramic-paint-maintenance',           'Ceramic Paint Maintenance',            'detailing', 240, 3,  5,  true,  250000,   260000,   280000,   300000),
    ('ppf-high-impact',                     'Front PPF + Coating Package',          'detailing', 720, 4,  10, true,  4800000,  5500000,  5500000,  6000000),
    ('ppf-basic',                           'Basic PPF Package',                    'detailing', 720, 5,  10, true,  7500000,  7500000,  7500000,  9000000),
    ('ppf-ultimate',                        'Ultimate PPF Package',                 'detailing', 720, 6,  10, true,  9400000,  9400000,  9400000,  11000000),
    ('ppf-platinum',                        'Platinum PPF Package',                 'detailing', 720, 7,  10, true,  13000000, 13000000, 13000000, 14500000),
    ('colored-ppf-package',                 'Colored PPF Package',                  'detailing', 720, 8,  10, true,  10500000, 10500000, 10500000, 12000000),
    ('satin-matte-ppf-package',             'Satin / Matte PPF Package',            'detailing', 720, 9,  10, true,  9400000,  9400000,  9400000,  11000000),
    ('nano-ceramic-tint',                   'Nano Ceramic Tint',                    'detailing', 240, 10, 10, true,  600000,   800000,   800000,   1000000),
    ('nano-ceramic-pro-tint',               'Nano Ceramic Pro Tint',                'detailing', 240, 11, 15, true,  1000000,  1200000,  1200000,  1400000),
    ('nano-ceramic-pro-black-series-tint',  'Nano Ceramic Pro Black Series Tint',   'detailing', 240, 12, 20, true,  1300000,  1500000,  1500000,  1700000),

    -- Car Wash, Packages & Treatments (21)
    ('premium-car-wash',                    'Premium Car Wash',                     'wash',      45,  20, 1,  false, 22000,    25000,    28000,    35000),
    ('premium-drip-wash',                   'Premium Drip Wash',                    'wash',      60,  21, 1,  false, 27000,    30000,    33000,    40000),
    ('premium-motorcycle-wash',             'Premium Motorcycle Wash',              'wash',      30,  22, 1,  false, 20000,    25000,    NULL::integer, NULL::integer),
    ('premium-motorcycle-wash-wax',         'Premium Motorcycle Wash + Wax',        'wash',      45,  23, 1,  false, 25000,    30000,    NULL::integer, NULL::integer),
    ('express-package',                     'Express Package',                      'package',   60,  24, 1,  false, 45000,    50000,    55000,    65000),
    ('basic-package',                       'Basic Package',                        'package',   75,  25, 2,  false, 75000,    80000,    85000,    95000),
    ('deluxe-package',                      'Deluxe Package',                       'package',   90,  26, 3,  false, 130000,   140000,   150000,   160000),
    ('paint-maintenance-package',           'Paint Maintenance Package',            'package',   180, 27, 5,  false, 300000,   330000,   360000,   400000),
    ('paint-refresh-package',               'Paint Refresh Package',                'package',   240, 28, 6,  false, 450000,   500000,   550000,   65000),
    ('headlight-restoration',               'Headlight Restoration',                'addon',     60,  29, 2,  false, 100000,   100000,   100000,   100000),
    ('headlight-coating',                   'Headlight Coating',                    'addon',     60,  30, 2,  false, 100000,   100000,   100000,   100000),
    ('black-trims-restoration',             'Black Trims Restoration',              'addon',     60,  31, 2,  false, 100000,   100000,   100000,   100000),
    ('soft-99-fusso-coat-treatment',        'Soft 99 Fusso Coat Treatment',         'addon',     45,  32, 1,  false, 40000,    45000,    50000,    60000),
    ('soft-99-luxury-gloss-treatment',      'Soft 99 Luxury Gloss Treatment',       'addon',     30,  33, 1,  false, 30000,    35000,    40000,    50000),
    ('glass-cleaning',                      'Glass Cleaning',                       'addon',     60,  34, 2,  false, 100000,   120000,   150000,   200000),
    ('glass-detailing',                     'Glass Detailing',                      'addon',     120, 35, 5,  false, 350000,   350000,   350000,   350000),
    ('glass-ceramic-coating',               'Glass Ceramic Coating',                'addon',     90,  36, 4,  false, 200000,   250000,   300000,   400000),
    ('interior-deep-cleaning',              'Interior Deep Cleaning',               'general',   180, 37, 6,  false, 450000,   500000,   550000,   650000),
    ('interior-full-detailing',             'Interior Full Detailing',              'general',   240, 38, 8,  false, 700000,   750000,   800000,   900000),
    ('1-step-detailing',                    '1 Step Detailing',                     'general',   180, 39, 5,  false, 350000,   400000,   450000,   600000),
    ('3-steps-detailing',                   '3 Steps Detailing',                    'general',   360, 40, 10, false, 900000,   950000,   1000000,  1200000)
),
upserted_services AS (
  INSERT INTO public.services (
    slug, name, pay_category, price_minor, currency, duration_minutes,
    display_order, points_award, referral_eligible, parent_service_id,
    is_active, is_archived, updated_at
  )
  SELECT
    ms.slug, ms.name, ms.pay_category, ms.m_minor, 'PHP', ms.duration_minutes,
    ms.display_order, ms.points_award, ms.referral_eligible, NULL,
    true, false, now()
  FROM master_services ms
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    pay_category = EXCLUDED.pay_category,
    price_minor = EXCLUDED.price_minor,
    duration_minutes = EXCLUDED.duration_minutes,
    display_order = EXCLUDED.display_order,
    points_award = EXCLUDED.points_award,
    referral_eligible = EXCLUDED.referral_eligible,
    parent_service_id = NULL,
    is_active = true,
    is_archived = false,
    updated_at = now()
  RETURNING id, slug
),
size_matrix AS (
  SELECT us.id AS service_id, v.size_slug, v.price_minor
  FROM upserted_services us
  JOIN master_services ms ON ms.slug = us.slug
  CROSS JOIN LATERAL (
    VALUES
      ('small',       ms.s_minor),
      ('medium',      ms.m_minor),
      ('large',       ms.l_minor),
      ('extra_large', ms.xl_minor)
  ) AS v(size_slug, price_minor)
  WHERE v.price_minor IS NOT NULL
),
upsert_sizes AS (
  INSERT INTO public.service_size_prices (service_id, size_slug, price_minor, updated_at)
  SELECT service_id, size_slug, price_minor, now()
  FROM size_matrix
  ON CONFLICT (service_id, size_slug) DO UPDATE SET
    price_minor = EXCLUDED.price_minor,
    updated_at = now()
  RETURNING service_id, size_slug
)
-- Remove disallowed size tiers (e.g. L/XL for motorcycles) if previously present
DELETE FROM public.service_size_prices ssp
USING upserted_services us, master_services ms
WHERE ssp.service_id = us.id
  AND ms.slug = us.slug
  AND (
    (ssp.size_slug = 'large' AND ms.l_minor IS NULL) OR
    (ssp.size_slug = 'extra_large' AND ms.xl_minor IS NULL)
  );

-- Archive all legacy / demo / test services outside the curated 33-service list
UPDATE public.services
SET is_active = false, is_archived = true, updated_at = now()
WHERE slug NOT IN (
  'ultimate-ceramic-coating',
  'platinum-ceramic-coating',
  'ceramic-paint-maintenance',
  'ppf-high-impact',
  'ppf-basic',
  'ppf-ultimate',
  'ppf-platinum',
  'colored-ppf-package',
  'satin-matte-ppf-package',
  'nano-ceramic-tint',
  'nano-ceramic-pro-tint',
  'nano-ceramic-pro-black-series-tint',
  'premium-car-wash',
  'premium-drip-wash',
  'premium-motorcycle-wash',
  'premium-motorcycle-wash-wax',
  'express-package',
  'basic-package',
  'deluxe-package',
  'paint-maintenance-package',
  'paint-refresh-package',
  'headlight-restoration',
  'headlight-coating',
  'black-trims-restoration',
  'soft-99-fusso-coat-treatment',
  'soft-99-luxury-gloss-treatment',
  'glass-cleaning',
  'glass-detailing',
  'glass-ceramic-coating',
  'interior-deep-cleaning',
  'interior-full-detailing',
  '1-step-detailing',
  '3-steps-detailing'
)
AND (is_active = true OR is_archived = false);

-- 2. Coffee Menu (6 items, Iced/Hot size_options) + 5 Sellables + Points Shop Keychain
WITH master_products (
  sku, name, category, stock_category, usage_kind, material_role, stock_group,
  price_minor, points_price, show_in_pos, show_in_app, tags, size_options
) AS (
  VALUES
    -- Coffee Menu
    ('COFFEE-AMERICANO', 'Americano', 'coffee', 'coffee_menu', 'resellable', NULL, 'coffee americano',
      9000, NULL::integer, true, true, ARRAY['coffee','sellable'],
      '[{"label":"Iced","price_minor":9000},{"label":"Hot","price_minor":9000}]'::jsonb),
    ('COFFEE-CAFE-LATTE', 'Café Latte', 'coffee', 'coffee_menu', 'resellable', NULL, 'coffee cafe latte',
      11000, NULL::integer, true, true, ARRAY['coffee','sellable'],
      '[{"label":"Iced","price_minor":11000},{"label":"Hot","price_minor":11000}]'::jsonb),
    ('COFFEE-CARAMEL-MACCHIATO', 'Caramel Macchiato', 'coffee', 'coffee_menu', 'resellable', NULL, 'coffee caramel macchiato',
      13000, NULL::integer, true, true, ARRAY['coffee','sellable'],
      '[{"label":"Iced","price_minor":13000},{"label":"Hot","price_minor":13000}]'::jsonb),
    ('COFFEE-VANILLA-LATTE', 'Vanilla Latte', 'coffee', 'coffee_menu', 'resellable', NULL, 'coffee vanilla latte',
      13000, NULL::integer, true, true, ARRAY['coffee','sellable'],
      '[{"label":"Iced","price_minor":13000},{"label":"Hot","price_minor":13000}]'::jsonb),
    ('COFFEE-SPANISH-LATTE', 'Spanish Latte', 'coffee', 'coffee_menu', 'resellable', NULL, 'coffee spanish latte',
      13000, NULL::integer, true, true, ARRAY['coffee','sellable'],
      '[{"label":"Iced","price_minor":13000},{"label":"Hot","price_minor":13000}]'::jsonb),
    ('COFFEE-IRISH-COFFEE', 'Irish Coffee', 'coffee', 'coffee_menu', 'resellable', NULL, 'coffee irish coffee',
      15000, NULL::integer, true, true, ARRAY['coffee','sellable'],
      '[{"label":"Iced","price_minor":15000},{"label":"Hot","price_minor":15000}]'::jsonb),

    -- Merch / Sellables (Cash + Points Shop where applicable)
    ('hakum-car-spray', 'Hakum Car Spray', 'merch', 'merchandise', 'resellable', NULL, 'hakum car spray',
      12000, NULL::integer, true, true, ARRAY['accessories','merch','sellable'], '[]'::jsonb),
    ('hakum-points-freshener', 'Hakum Car Scent', 'merch', 'merchandise', 'resellable', NULL, 'hakum car scent',
      22000, 30, true, true, ARRAY['scents','accessories','merch','sellable'], '[]'::jsonb),
    ('hakum-points-tshirt', 'Hakum Tshirt', 'merch', 'merchandise', 'resellable', NULL, 'hakum shirt',
      60000, 50, true, true, ARRAY['clothing','apparel','merch','sellable'],
      '[{"label":"S","price_minor":60000},{"label":"M","price_minor":60000},{"label":"L","price_minor":60000},{"label":"XL","price_minor":60000},{"label":"2XL","price_minor":60000}]'::jsonb),
    ('hakum-car-care-kit', 'Hakum Car Care Kit', 'merch', 'merchandise', 'resellable', NULL, 'hakum car care kit',
      250000, 50, true, true, ARRAY['accessories','merch','sellable'], '[]'::jsonb),
    ('air-spencer', 'Air Spencer', 'merch', 'merchandise', 'resellable', NULL, 'air spencer',
      34000, 30, true, true, ARRAY['scents','accessories','merch','sellable'], '[]'::jsonb),

    -- Points-only merch kept active for customer rewards
    ('hakum-points-keychain', 'Hakum Keychain', 'merch', 'merchandise', 'resellable', NULL, 'hakum keychain',
      0, 20, false, true, ARRAY['accessories','merch'], '[]'::jsonb)
)
INSERT INTO public.products (
  sku, name, category, stock_category, usage_kind, material_role, stock_group,
  price_minor, points_price, show_in_pos, show_in_app, tags, size_options,
  currency, is_active, is_archived, updated_at
)
SELECT
  mp.sku, mp.name, mp.category, mp.stock_category, mp.usage_kind, mp.material_role, mp.stock_group,
  mp.price_minor, mp.points_price, mp.show_in_pos, mp.show_in_app, mp.tags, mp.size_options,
  'PHP', true, false, now()
FROM master_products mp
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  stock_category = EXCLUDED.stock_category,
  usage_kind = EXCLUDED.usage_kind,
  material_role = EXCLUDED.material_role,
  stock_group = EXCLUDED.stock_group,
  price_minor = EXCLUDED.price_minor,
  points_price = EXCLUDED.points_price,
  show_in_pos = EXCLUDED.show_in_pos,
  show_in_app = EXCLUDED.show_in_app,
  tags = EXCLUDED.tags,
  size_options = EXCLUDED.size_options,
  is_active = true,
  is_archived = false,
  updated_at = now();

-- Archive legacy/demo/duplicate products outside the curated catalog + operational materials (coffee_material, chemical)
UPDATE public.products
SET is_active = false, is_archived = true, updated_at = now()
WHERE stock_category NOT IN ('coffee_material', 'chemical')
  AND sku NOT IN (
    'COFFEE-AMERICANO',
    'COFFEE-CAFE-LATTE',
    'COFFEE-CARAMEL-MACCHIATO',
    'COFFEE-VANILLA-LATTE',
    'COFFEE-SPANISH-LATTE',
    'COFFEE-IRISH-COFFEE',
    'hakum-car-spray',
    'hakum-points-freshener',
    'hakum-points-tshirt',
    'hakum-car-care-kit',
    'air-spencer',
    'hakum-points-keychain'
  )
  AND (is_active = true OR is_archived = false);

-- Ensure product_branch_stock rows exist for all active resellable products & size keys across active operational branches
SELECT set_config('hakum.restock_approve', '1', true);

INSERT INTO public.product_branch_stock (product_id, branch_slug, size_key, qty, updated_at)
SELECT
  p.id,
  b.slug,
  sz.size_key,
  50,
  now()
FROM public.products p
JOIN public.branches b ON b.is_active = true AND NOT b.is_archived AND b.slug <> 'hq'
CROSS JOIN LATERAL (
  SELECT lower(trim(opt->>'label')) AS size_key
  FROM jsonb_array_elements(p.size_options) AS opt
  WHERE jsonb_array_length(p.size_options) > 0
  UNION ALL
  SELECT '' AS size_key
  WHERE jsonb_array_length(p.size_options) = 0
) sz
WHERE p.is_active = true
  AND NOT p.is_archived
  AND p.usage_kind = 'resellable'
ON CONFLICT (product_id, branch_slug, size_key) DO NOTHING;

COMMIT;
