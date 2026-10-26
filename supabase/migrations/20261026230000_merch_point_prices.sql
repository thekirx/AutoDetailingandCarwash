-- Point-shop merch from the 25 Oct notes.
-- No peso price, so they stay off the register until someone sets one.
-- A claim still needs branch stock, and redeem deducts that branch.

insert into public.products (
  name, sku, category, price_minor, stock_qty, tags, usage_kind,
  stock_category, show_in_pos, points_price, is_active, is_archived
)
select v.name, v.sku, 'merch', 0, 0, array['sellable', 'merch']::text[], 'resellable',
       'merchandise', false, v.points, true, false
from (values
  ('Hakum Shirt', 'hakum-shirt', 50),
  ('Clear Pro mug', 'clear-pro-mug', 30),
  ('Clear Pro Yellow Bag', 'clear-pro-yellow-bag', 30),
  ('Clear Pro Coffee Kit', 'clear-pro-coffee-kit', 60),
  ('Hakum Key Chain', 'hakum-key-chain', 20),
  ('Hakum Car Care Kit', 'hakum-car-care-kit', 50),
  ('Fusso coat spray', 'fusso-coat-spray', 50),
  ('Luxury gloss spray', 'luxury-gloss-spray', 50),
  ('Hakum car scent', 'hakum-car-scent', 30),
  ('Air Spencer', 'air-spencer', 30)
) as v(name, sku, points)
where not exists (
  select 1 from public.products p
  where lower(trim(p.name)) = lower(v.name)
    and p.is_archived = false
);
