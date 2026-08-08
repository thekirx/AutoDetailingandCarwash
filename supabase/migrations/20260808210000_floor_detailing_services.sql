-- Floor detailing catalog for TL/Sales form bookings + multi-day queue.
-- Ceramic Coating, Nano Ceramic Tint, Paint Protection Film (PPF).
-- pay_category = detailing → crew required (not package/ppf kind).

insert into public.services (
  id, name, slug, pay_category, price_minor, duration_minutes,
  display_order, is_active, is_archived, description
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Ceramic Coating',
    'ceramic-coating',
    'detailing',
    1500000,
    480,
    10,
    true,
    false,
    'Multi-day ceramic coating. Crew required.'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Nano Ceramic Tint',
    'nano-ceramic-tint',
    'detailing',
    800000,
    360,
    20,
    true,
    false,
    'Multi-day nano ceramic window tint. Crew required.'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Paint Protection Film (PPF)',
    'paint-protection-film',
    'detailing',
    2500000,
    720,
    30,
    true,
    false,
    'Multi-day PPF install. Crew required.'
  )
on conflict (slug) do update set
  name = excluded.name,
  pay_category = excluded.pay_category,
  price_minor = excluded.price_minor,
  duration_minutes = excluded.duration_minutes,
  display_order = excluded.display_order,
  is_active = true,
  is_archived = false,
  description = excluded.description;

-- Size matrix (medium = services.price_minor)
insert into public.service_size_prices (service_id, size_slug, price_minor)
select s.id, sizes.size_slug, sizes.price_minor
from public.services s
cross join lateral (
  values
    ('small', round(s.price_minor * 0.85)::int),
    ('medium', s.price_minor),
    ('large', round(s.price_minor * 1.2)::int),
    ('extra_large', round(s.price_minor * 1.4)::int)
) as sizes(size_slug, price_minor)
where s.slug in ('ceramic-coating', 'nano-ceramic-tint', 'paint-protection-film')
on conflict (service_id, size_slug) do update set
  price_minor = excluded.price_minor;
