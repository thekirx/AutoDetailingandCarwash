-- Public aftercare/merch/coffee catalog RPC, contact_inquiries stale policy cleanup,
-- customer-facing product copy polish, and branch Google Review links.
begin;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_super_admin'
  ) then raise exception 'public.is_super_admin() is missing — apply helper migration first';
  end if;
end $$;

create or replace function public.get_public_shop_catalog()
returns table (
  id uuid,
  name text,
  category text,
  description text,
  price_minor integer,
  points_price integer,
  photo_url text,
  size_options jsonb,
  bacoor_in_stock boolean,
  batangas_in_stock boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.name,
    p.category,
    p.description,
    p.price_minor,
    p.points_price,
    p.photo_url,
    p.size_options,
    exists (
      select 1
      from public.product_branch_stock s
      where s.product_id = p.id
        and s.branch_slug = 'bacoor'
        and s.qty > 0
    ) as bacoor_in_stock,
    exists (
      select 1
      from public.product_branch_stock s
      where s.product_id = p.id
        and s.branch_slug = 'batangas'
        and s.qty > 0
    ) as batangas_in_stock
  from public.products p
  where p.is_active = true
    and p.is_archived = false
    and p.usage_kind = 'resellable'
    and p.show_in_app = true
  order by p.category asc, p.points_price nulls last, p.name asc;
$$;

revoke all on function public.get_public_shop_catalog() from public, anon, authenticated;
grant execute on function public.get_public_shop_catalog() to anon, authenticated;

drop policy if exists "Anon insert contact" on public.contact_inquiries;

update public.products
set description = case name
  when 'Hakum Car Scent' then 'Studio-signature clean cabin mist crafted to refresh interiors without oily residue on leather or matte trim.'
  when 'Hakum Keychain' then 'Heavy-duty woven Hakum Auto Care studio key tag designed to resist scratching painted center consoles.'
  when 'Hakum Tshirt' then 'Soft heavyweight studio tee embroidered with the Hakum crest — available in S to 2XL across open branches.'
  when 'Air Spencer' then 'Genuine Japanese solid cabin air freshener delivering long-lasting citrus squash fragrance in warm parking conditions.'
  when 'Hakum Car Care Kit' then 'Curated pH-neutral maintenance starter kit formulated for ceramic-coated, PPF-protected, and daily-driven cars.'
  when 'Hakum Car Spray' then 'Quick-wipe hydrophobic surface mist for removing light highway dust and water spots safely between studio washes.'
  when 'Fusso coat spray' then 'High-gloss fluoropolymer sealant booster reinforcing water beading and slickness over coated or waxed panels.'
  when 'Luxury gloss spray' then 'Quick exhibition-grade finish enhancer restoring slick mirror depth without smearing dark clear coats.'
  when 'Clear Pro Coffee Kit' then 'Limited ClearPro studio gift coffee drip kit curated for partner detailing enthusiasts.'
  when 'Clear Pro mug' then 'Insulated ClearPro matte black travel tumbler sized for standard vehicle center cupholders.'
  when 'Clear Pro Yellow Bag' then 'Weather-resistant ClearPro signature utility tote sized for storing drying towels and quick-detailer bottles.'
  when 'Americano' then 'Double-shot freshly pulled Hakum house Arabica over filtered ice water for a clean, bright studio lounge cup.'
  when 'Café Latte' then 'Rich espresso balanced with steamed whole milk — available Hot or Iced while your vehicle finishes in-bay.'
  when 'Caramel Macchiato' then 'Layered vanilla milk, velvety espresso, and caramelized drizzle served in the air-conditioned Hakum waiting lounge.'
  when 'Irish Coffee' then 'Bold zero-proof Hakum lounge espresso infused with cream and toasted cocoa aromatics while you wait.'
  when 'Spanish Latte' then 'Slow-sweetened condensed milk and double-shot house espresso blended over ice for Bacoor and Batangas guests.'
  when 'Vanilla Latte' then 'Smooth Madagascar vanilla folded into house espresso and cold or steamed milk for relaxed bay wait times.'
  else description
end
where name in (
  'Hakum Car Scent',
  'Hakum Keychain',
  'Hakum Tshirt',
  'Air Spencer',
  'Hakum Car Care Kit',
  'Hakum Car Spray',
  'Fusso coat spray',
  'Luxury gloss spray',
  'Clear Pro Coffee Kit',
  'Clear Pro mug',
  'Clear Pro Yellow Bag',
  'Americano',
  'Café Latte',
  'Caramel Macchiato',
  'Irish Coffee',
  'Spanish Latte',
  'Vanilla Latte'
)
and (description is null or description like 'Placeholder item%');

update public.branches
set google_review_url = 'https://www.google.com/maps?cid=38179785010672017'
where slug = 'bacoor'
  and nullif(trim(google_review_url), '') is null;

update public.branches
set google_review_url = 'https://www.google.com/maps?cid=9079854389115198830'
where slug = 'batangas'
  and nullif(trim(google_review_url), '') is null;

commit;
