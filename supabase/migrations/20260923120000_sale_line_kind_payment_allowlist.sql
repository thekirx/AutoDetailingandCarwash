-- Stamp each paid line as service, package, detailing, ppf, or merch.
-- Reject payment methods that Super Admin has not enabled in POS settings.

alter table public.sale_line_items
  add column if not exists line_kind text;

alter table public.sale_line_items
  drop constraint if exists sale_line_items_line_kind_check;

alter table public.sale_line_items
  add constraint sale_line_items_line_kind_check
  check (
    line_kind is null
    or line_kind in ('service', 'package', 'detailing', 'ppf', 'merch')
  );

create or replace function public.catalog_line_kind(
  p_item_type text,
  p_pay_category text,
  p_slug text default null
)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_item_type, '')) = 'product' then 'merch'
    when lower(coalesce(p_slug, '')) in ('ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint')
      or lower(coalesce(p_pay_category, '')) = 'detailing' then 'detailing'
    when lower(coalesce(p_pay_category, '')) = 'ppf'
      or lower(coalesce(p_slug, '')) = 'paint-protection-film'
      or lower(coalesce(p_slug, '')) like '%ppf%' then 'ppf'
    when lower(coalesce(p_pay_category, '')) = 'package' then 'package'
    else 'service'
  end;
$$;

revoke all on function public.catalog_line_kind(text, text, text) from public, anon;
grant execute on function public.catalog_line_kind(text, text, text) to authenticated;

create or replace function public.stamp_sale_line_kind()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cat text;
  v_slug text;
begin
  if new.item_type = 'product' then
    new.line_kind := 'merch';
    return new;
  end if;
  if new.service_id is not null then
    select s.pay_category, s.slug into v_cat, v_slug
    from public.services s
    where s.id = new.service_id;
  end if;
  new.line_kind := public.catalog_line_kind('service', v_cat, v_slug);
  return new;
end;
$$;

drop trigger if exists sale_line_items_stamp_kind on public.sale_line_items;
create trigger sale_line_items_stamp_kind
  before insert or update of service_id, product_id, item_type
  on public.sale_line_items
  for each row
  execute function public.stamp_sale_line_kind();

update public.sale_line_items sli
set line_kind = public.catalog_line_kind('service', svc.pay_category, svc.slug)
from public.services svc
where sli.service_id = svc.id
  and sli.item_type = 'service';

update public.sale_line_items
set line_kind = 'merch'
where item_type = 'product';

update public.sale_line_items
set line_kind = 'service'
where line_kind is null;

create or replace function public.assert_pos_sale_integrity(payload jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  line jsonb;
  v_customer uuid := nullif(payload->>'customer_id', '')::uuid;
  v_handoff uuid := nullif(payload->>'pos_handoff_id', '')::uuid;
  v_method text := lower(trim(coalesce(payload->>'payment_method', 'cash')));
  v_ref text := trim(coalesce(payload->>'payment_ref', ''));
  v_reason text := trim(coalesce(payload->>'discount_reason', ''));
  v_stamps int;
  v_need int;
  award_count int := 0;
  bday_count int := 0;
  catalog_price int;
  unit int;
  qty int;
  item_type text;
  v_size text;
  v_methods jsonb;
  v_allowed boolean := false;
begin
  select case
    when jsonb_typeof(payment_methods) = 'array' and jsonb_array_length(payment_methods) > 0
      then payment_methods
    else '[{"value":"cash"},{"value":"gcash"},{"value":"card"}]'::jsonb
  end
  into v_methods
  from public.ops_pos_settings
  where id = 1;

  if v_methods is null then
    v_methods := '[{"value":"cash"},{"value":"gcash"},{"value":"card"}]'::jsonb;
  end if;

  select exists (
    select 1
    from jsonb_array_elements(v_methods) as m
    where lower(trim(coalesce(
      case when jsonb_typeof(m) = 'object' then m->>'value' else m #>> '{}' end,
      ''
    ))) = v_method
  ) into v_allowed;

  if not coalesce(v_allowed, false) then
    raise exception 'Payment method is not enabled in POS settings';
  end if;

  if v_method <> 'cash' and length(v_ref) < 4 then
    raise exception 'Payment reference required for %', v_method;
  end if;

  for line in select * from jsonb_array_elements(coalesce(payload->'lines', '[]'::jsonb))
  loop
    qty := coalesce((line->>'quantity')::int, 1);
    if qty < 1 or qty > 99 then
      raise exception 'Quantity must be between 1 and 99';
    end if;
    unit := coalesce((line->>'unit_price_minor')::int, 0);
    if unit < 0 then
      raise exception 'Negative line price is not allowed';
    end if;

    if coalesce((line->>'is_loyalty_award')::boolean, false)
       and not coalesce((line->>'is_birthday_award')::boolean, false) then
      award_count := award_count + 1;
      if v_customer is null then
        raise exception 'Link a customer before redeeming loyalty';
      end if;
      if unit <> 0 then
        raise exception 'Loyalty award lines must be free';
      end if;
    end if;

    if coalesce((line->>'is_birthday_award')::boolean, false) then
      bday_count := bday_count + 1;
      if v_customer is null then
        raise exception 'Link a customer before redeeming a birthday perk';
      end if;
    end if;

    if coalesce((line->>'is_loyalty_award')::boolean, false)
       or coalesce((line->>'is_birthday_award')::boolean, false)
       or coalesce((line->>'is_membership_included')::boolean, false) then
      continue;
    end if;

    item_type := line->>'item_type';
    if v_handoff is not null and item_type = 'service' then
      continue;
    end if;

    if item_type = 'product' then
      select p.price_minor into catalog_price
      from public.products p
      where p.id = (line->>'product_id')::uuid and p.is_active and not p.is_archived;
      if catalog_price is null then
        raise exception 'Product not found or inactive';
      end if;
    elsif item_type = 'service' then
      v_size := nullif(trim(coalesce(line->>'vehicle_size', '')), '');
      catalog_price := null;
      if v_size is not null then
        select ssp.price_minor into catalog_price
        from public.service_size_prices ssp
        where ssp.service_id = (line->>'service_id')::uuid and ssp.size_slug = v_size;
      end if;
      if catalog_price is null then
        select s.price_minor into catalog_price
        from public.services s
        where s.id = (line->>'service_id')::uuid and s.is_active and not s.is_archived;
      end if;
      if catalog_price is null then
        raise exception 'Service not found or inactive';
      end if;
    else
      continue;
    end if;

    if unit > catalog_price then
      raise exception 'Line priced above catalog';
    end if;
    if unit < catalog_price and length(v_reason) < 3 then
      raise exception 'Discount needs a reason (3+ characters)';
    end if;
  end loop;

  if award_count > 1 then
    raise exception 'One loyalty award per sale';
  end if;
  if bday_count > 1 then
    raise exception 'One birthday award per sale';
  end if;

  if award_count > 0 then
    select c.loyalty_stamps into v_stamps from public.customers c where c.id = v_customer;
    select min(m.threshold_points) into v_need
    from public.loyalty_milestones m
    where coalesce(m.is_active, true)
      and m.threshold_points <= coalesce(v_stamps, 0);
    if v_need is null then
      raise exception 'Customer has no redeemable loyalty reward';
    end if;
  end if;

  if bday_count > 0
     and to_regclass('public.customer_birthday_perks') is not null
     and not exists (
       select 1
       from public.customer_birthday_perks p
       where p.customer_id = v_customer
         and p.status = 'available'
         and p.expires_at > clock_timestamp()
     ) then
    raise exception 'No birthday perk available';
  end if;
end;
$$;

drop view if exists public.finance_daily_line_kind;
create view public.finance_daily_line_kind
with (security_invoker = true)
as
select
  s.branch,
  (s.occurred_at at time zone 'Asia/Manila')::date as period_date,
  coalesce(sli.line_kind, public.catalog_line_kind(sli.item_type, svc.pay_category, svc.slug)) as line_kind,
  coalesce(sum(sli.line_total_minor), 0)::bigint as amount_minor
from public.sales s
join public.sale_line_items sli on sli.sale_id = s.id
left join public.services svc on svc.id = sli.service_id
where s.status = 'paid'
group by 1, 2, 3;

revoke all on public.finance_daily_line_kind from public, anon, authenticated;
grant select on public.finance_daily_line_kind to authenticated;
