-- Public "Starts at ₱…" prices for the website.
--
-- The per-size price table (service_size_prices) is readable only by signed-in
-- staff, and services.price_minor is the Medium price, not the lowest. This
-- function hands the public site exactly one number per active service: the
-- lowest non-zero size price, falling back to the catalog price. Nothing else
-- about the catalog is exposed. A service with no real price returns null, so
-- the site never shows "Starts at ₱0".

create or replace function public.get_public_service_starting_prices()
returns table (slug text, starting_price_minor integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.slug,
    coalesce(
      min(p.price_minor) filter (where p.price_minor > 0),
      nullif(s.price_minor, 0)
    ) as starting_price_minor
  from public.services s
  left join public.service_size_prices p on p.service_id = s.id
  where s.is_active = true
    and s.is_archived = false
  group by s.id, s.slug, s.price_minor;
$$;

revoke all on function public.get_public_service_starting_prices() from public;
grant execute on function public.get_public_service_starting_prices() to anon, authenticated;

comment on function public.get_public_service_starting_prices() is
  'Public website: lowest non-zero price per active service (null when unpriced).';
