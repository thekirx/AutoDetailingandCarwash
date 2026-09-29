-- Detailing packages, per-service visit points, and a Google review link per branch.

alter table public.services
  add column if not exists points_award integer not null default 0 check (points_award >= 0 and points_award <= 1000),
  add column if not exists parent_service_id uuid references public.services(id) on delete set null;

create index if not exists services_parent_idx on public.services (parent_service_id);

alter table public.branches
  add column if not exists google_review_url text;

update public.services
set points_award = case
  when slug ilike '%ppf%' or slug ilike '%paint-protection%' or name ilike '%paint protection%' then 10
  when slug ilike '%tint%' or name ilike '%tint%' then 3
  when slug ilike '%ceramic%' or name ilike '%ceramic%' then 5
  when slug ilike '%express%' or name ilike '%express%' then 2
  when pay_category = 'wash' or slug ilike '%carwash%' or slug ilike '%car-wash%' or name ilike '%carwash%' then 1
  when pay_category = 'detailing' then 3
  else points_award
end
where points_award = 0;

insert into public.services (name, slug, description, price_minor, duration_minutes, pay_category, display_order, is_active, is_archived, loyalty_weight, points_award, parent_service_id)
select v.name, v.slug, v.description, v.price_minor, coalesce(p.duration_minutes, 60), 'detailing', v.display_order, true, false, 1, v.points, p.id
from (values
  ('ceramic-coating', 'Premium', 'ceramic-coating-premium', 'Deeper gloss and stronger water repellency, covered for five years.', 0, 5, 1),
  ('ceramic-coating', 'Platinum', 'ceramic-coating-platinum', 'Our highest gloss and longest paint preservation, covered for eight years.', 0, 5, 2),
  ('paint-protection-film', 'High Impact Partial', 'ppf-high-impact', 'Film on the front of the car, ceramic coating on the rest. From ₱48,000.', 4800000, 10, 1),
  ('paint-protection-film', 'Basic PPF Protection', 'ppf-basic', 'Full-body protection on 7.5 mil film with a 7-year warranty. From ₱75,000.', 7500000, 10, 2),
  ('paint-protection-film', 'Ultimate PPF Protection', 'ppf-ultimate', 'Thicker full-body film, 10-year warranty, panel replacement. From ₱94,000.', 9400000, 10, 3),
  ('paint-protection-film', 'Platinum PPF Protection', 'ppf-platinum', 'Thickest film, rocker panels, 12-year warranty. From ₱130,000.', 13000000, 10, 4)
) as v(parent_slug, name, slug, description, price_minor, points, display_order)
join public.services p on p.slug = v.parent_slug
where not exists (select 1 from public.services s where s.slug = v.slug);

create or replace function public.sale_service_points(p_sale uuid)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(sum(
    greatest(coalesce(s.points_award, 0), 0) * greatest(coalesce(li.quantity, 1), 1)
  ), 0)::integer
  from public.sale_line_items li
  join public.services s on s.id = li.service_id
  where li.sale_id = p_sale
    and li.service_id is not null;
$$;

revoke all on function public.sale_service_points(uuid) from public, anon, authenticated;

do $$
declare src text;
begin
  src := pg_get_functiondef('public.complete_pos_sale_impl(jsonb)'::regprocedure);
  src := replace(
    src,
    'loyalty_delta := greatest(floor((service_total / 100.0) * coalesce(multiplier, 1))::int, 0);',
    'loyalty_delta := greatest(floor(public.sale_service_points(sale_id) * coalesce(multiplier, 1))::int, 0);'
  );
  if src not like '%sale_service_points%' then
    raise exception 'complete_pos_sale_impl loyalty formula was not updated';
  end if;
  execute src;
end $$;

create or replace function public.set_branch_google_review_url(input_slug text, input_url text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.current_user_role() not in ('BossMich', 'assistant_super_admin') then
    raise exception using errcode = '42501', message = 'Only Super Admin can set the Google review link';
  end if;
  if nullif(trim(coalesce(input_url, '')), '') is not null
     and trim(input_url) !~ '^https://' then
    raise exception 'Review link must start with https://';
  end if;
  update public.branches
  set google_review_url = nullif(trim(coalesce(input_url, '')), ''),
      updated_at = clock_timestamp()
  where slug = input_slug
    and is_archived = false;
  if not found then
    raise exception 'Branch not found';
  end if;
end;
$$;

revoke all on function public.set_branch_google_review_url(text, text) from public, anon;
grant execute on function public.set_branch_google_review_url(text, text) to authenticated;
