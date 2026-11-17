-- 17 Nov 2026 client rules (Kirk): keep the 15 Nov real catalog, apply the published rewards.
-- 1) Visit rewards, any car: 6 freshener, 12 coffee, 18 premium wash, 24 Bac-to-zero, 30 = 15% off
--    tint / ceramic coating / PPF (choose one). Stamp card grows to 30. Old 10/15 rewards are
--    switched off, not deleted, so past earned rows keep their reference.
-- 2) Points per service from the client table. Ultimate ceramic = Premium tier (20); Colored and
--    Satin/Matte PPF = Ultimate PPF (50), per Kirk 17 Nov. Rows not on the table are untouched.
-- 3) Five points-shop merch items that were missing. Points only (no peso price, not on POS);
--    branch stock starts at 0 so a claim stays disabled until the branch restocks.

BEGIN;

-- 1. Visit rewards + 30-stamp card
UPDATE public.loyalty_milestones SET is_active = false WHERE threshold_points NOT IN (6, 12, 18, 24, 30);

INSERT INTO public.loyalty_milestones (threshold_points, reward_label, reward_description, sort_order, is_active)
SELECT v.t, v.label, v.descr, v.t, true
FROM (VALUES
  (6,  'Free car freshener',      'Every 6th visit, any car on your account.'),
  (12, 'Free coffee',             'Your 12th visit, any car on your account.'),
  (18, 'Free premium car wash',   'Your 18th visit, any car on your account.'),
  (24, 'Free Bac-to-zero add-on', 'Your 24th visit, any car on your account.'),
  (30, '15% off Tint, Ceramic Coating or PPF', 'Your 30th visit. Choose one service.')
) AS v(t, label, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM public.loyalty_milestones m WHERE m.threshold_points = v.t AND m.is_active
);

UPDATE public.loyalty_milestones m
SET reward_label = v.label, reward_description = v.descr, sort_order = v.t
FROM (VALUES
  (6,  'Free car freshener',      'Every 6th visit, any car on your account.'),
  (12, 'Free coffee',             'Your 12th visit, any car on your account.'),
  (18, 'Free premium car wash',   'Your 18th visit, any car on your account.'),
  (24, 'Free Bac-to-zero add-on', 'Your 24th visit, any car on your account.'),
  (30, '15% off Tint, Ceramic Coating or PPF', 'Your 30th visit. Choose one service.')
) AS v(t, label, descr)
WHERE m.threshold_points = v.t AND m.is_active;

UPDATE public.loyalty_program_settings SET card_slots = 30 WHERE id = 1;

-- 2. Points per service (slug = live 15 Nov catalog)
UPDATE public.services s
SET points_award = v.pts, updated_at = now()
FROM (VALUES
  ('premium-car-wash', 1),
  ('express-package', 2),
  ('basic-package', 3),
  ('deluxe-package', 4),
  ('paint-maintenance-package', 5),
  ('ceramic-paint-maintenance', 5),
  ('paint-refresh-package', 5),
  ('glass-cleaning', 3),
  ('headlight-restoration', 3),
  ('black-trims-restoration', 3),
  ('glass-detailing', 5),
  ('glass-ceramic-coating', 5),
  ('ultimate-ceramic-coating', 20),
  ('platinum-ceramic-coating', 25),
  ('nano-ceramic-tint', 10),
  ('nano-ceramic-pro-tint', 15),
  ('nano-ceramic-pro-black-series-tint', 20),
  ('interior-full-detailing', 10),
  ('interior-deep-cleaning', 5),
  ('ppf-high-impact', 30),
  ('ppf-basic', 40),
  ('ppf-ultimate', 50),
  ('ppf-platinum', 60),
  ('colored-ppf-package', 50),
  ('satin-matte-ppf-package', 50)
) AS v(slug, pts)
WHERE s.slug = v.slug;

-- 3. Missing points-shop merch
INSERT INTO public.products (
  sku, name, category, stock_category, usage_kind, material_role, stock_group,
  price_minor, points_price, show_in_pos, show_in_app, tags, size_options,
  currency, is_active, is_archived, updated_at
)
SELECT v.sku, v.name, 'merch', 'merchandise', 'resellable', NULL, v.grp,
       0, v.pts, false, true, ARRAY['merch'], '[]'::jsonb,
       'PHP', true, false, now()
FROM (VALUES
  ('clear-pro-mug',         'Clear Pro Mug',          30, 'clear pro mug'),
  ('clear-pro-yellow-bag',  'Clear Pro Yellow Bag',   30, 'clear pro yellow bag'),
  ('clear-pro-coffee-kit',  'Clear Pro Coffee Kit',   60, 'clear pro coffee kit'),
  ('fusso-coat-spray',      'Fusso Coat Spray',       50, 'fusso coat spray'),
  ('luxury-gloss-spray',    'Luxury Gloss Spray',     50, 'luxury gloss spray')
) AS v(sku, name, pts, grp)
ON CONFLICT (sku) DO UPDATE SET
  points_price = EXCLUDED.points_price,
  show_in_app = true,
  is_active = true,
  is_archived = false,
  updated_at = now();

INSERT INTO public.product_branch_stock (product_id, branch_slug, size_key, qty, updated_at)
SELECT p.id, b.slug, '', 0, now()
FROM public.products p
JOIN public.branches b ON b.is_active AND NOT b.is_archived AND b.slug <> 'hq'
WHERE p.sku IN ('clear-pro-mug', 'clear-pro-yellow-bag', 'clear-pro-coffee-kit', 'fusso-coat-spray', 'luxury-gloss-spray')
ON CONFLICT DO NOTHING;

COMMIT;
