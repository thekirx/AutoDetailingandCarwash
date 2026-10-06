-- Branch Admin counter: merch/coffee (+ locked queue ticket services) only.
-- Blocks crafted walk-in bay/detailing service lines and BA POS discounts at the RPC trust boundary.

create or replace function public.assert_branch_admin_pos_cart(payload jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  line jsonb;
  v_handoff uuid := nullif(payload->>'pos_handoff_id', '')::uuid;
  v_reason text := trim(coalesce(payload->>'discount_reason', ''));
  v_discount int := coalesce((payload->>'discount_minor')::int, 0);
  v_role text := public.current_user_role();
  v_service uuid;
  v_ok boolean;
begin
  if v_role is distinct from 'admin' then
    return;
  end if;

  if v_discount > 0 or length(v_reason) > 0 then
    raise exception 'Branch Admin cannot apply POS discounts';
  end if;

  for line in select * from jsonb_array_elements(coalesce(payload->'lines', '[]'::jsonb))
  loop
    -- Service lines first (do not skip via membership/award flags — that was a bypass).
    if coalesce(line->>'item_type', '') = 'service' then
      if v_handoff is null then
        raise exception 'Branch Admin sells merch and coffee only — open a queue ticket for bay jobs';
      end if;
      v_service := nullif(line->>'service_id', '')::uuid;
      if v_service is null then
        raise exception 'Queue ticket has no linked service';
      end if;
      select exists (
        select 1
        from public.pos_handoffs ph
        join public.bookings b on b.id = ph.booking_id
        where ph.id = v_handoff
          and (
            b.service_id = v_service
            or (
              b.visit_group_id is not null
              and exists (
                select 1
                from public.bookings sib
                where sib.visit_group_id = b.visit_group_id
                  and sib.service_id = v_service
              )
            )
          )
      ) into v_ok;
      if not coalesce(v_ok, false) then
        raise exception 'Branch Admin cannot add bay or detailing services on the counter';
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.assert_branch_admin_pos_cart(jsonb) from public, anon;
grant execute on function public.assert_branch_admin_pos_cart(jsonb) to authenticated;

create or replace function public.complete_pos_sale(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  sale uuid;
begin
  perform public.assert_branch_admin_pos_cart(payload);
  perform public.assert_pos_sale_integrity(payload);
  result := public.complete_pos_sale_impl(payload);
  sale := nullif(result->>'sale_id', '')::uuid;
  if sale is not null then
    update public.sales
    set
      payment_ref = nullif(trim(coalesce(payload->>'payment_ref', '')), ''),
      discount_reason = nullif(trim(coalesce(payload->>'discount_reason', '')), ''),
      discount_minor = greatest(coalesce((payload->>'discount_minor')::int, 0), 0)
    where id = sale;
  end if;
  perform public.redeem_pos_loyalty_awards(payload);
  return result;
end;
$$;

revoke all on function public.complete_pos_sale(jsonb) from public, anon;
grant execute on function public.complete_pos_sale(jsonb) to authenticated;
