-- One loyalty stamp per visit (or per walk-in sale), not per service line.

alter table public.bookings
  add column if not exists loyalty_stamp_awarded_at timestamptz;

alter table public.sales
  add column if not exists loyalty_stamp_awarded_at timestamptz;

create or replace function public.award_visit_stamp(
  input_customer_id uuid,
  input_booking_id uuid,
  input_sale_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  settings public.loyalty_program_settings%rowtype;
  visit uuid;
  new_stamps integer;
begin
  if input_customer_id is null then
    return 0;
  end if;

  select * into settings from public.loyalty_program_settings where id = 1;
  if not found or settings.stamps_enabled is not true then
    return 0;
  end if;

  if input_sale_id is not null and exists (
    select 1 from public.sales s
    where s.id = input_sale_id and s.loyalty_stamp_awarded_at is not null
  ) then
    return 0;
  end if;

  if input_booking_id is not null then
    select b.visit_group_id into visit from public.bookings b where b.id = input_booking_id;
    if exists (
      select 1 from public.bookings b
      where b.loyalty_stamp_awarded_at is not null
        and (
          b.id = input_booking_id
          or (visit is not null and b.visit_group_id = visit)
        )
    ) then
      if input_sale_id is not null then
        update public.sales
        set loyalty_stamp_awarded_at = clock_timestamp()
        where id = input_sale_id and loyalty_stamp_awarded_at is null;
      end if;
      return 0;
    end if;
  end if;

  update public.customers c
  set loyalty_stamps = c.loyalty_stamps + 1,
      updated_at = clock_timestamp()
  where c.id = input_customer_id
  returning c.loyalty_stamps into new_stamps;

  if new_stamps is null then
    return 0;
  end if;

  if input_booking_id is not null then
    update public.bookings b
    set loyalty_stamp_awarded_at = clock_timestamp()
    where b.loyalty_stamp_awarded_at is null
      and (
        b.id = input_booking_id
        or (visit is not null and b.visit_group_id = visit)
      );
  end if;

  if input_sale_id is not null then
    update public.sales
    set loyalty_stamp_awarded_at = clock_timestamp()
    where id = input_sale_id and loyalty_stamp_awarded_at is null;
  end if;

  if settings.wrap_stamps_at_card
     and settings.card_slots > 0
     and new_stamps >= settings.card_slots then
    update public.customers c
    set loyalty_stamps = new_stamps % settings.card_slots,
        updated_at = clock_timestamp()
    where c.id = input_customer_id;
  end if;

  return 1;
end;
$$;

revoke all on function public.award_visit_stamp(uuid, uuid, uuid) from public, anon, authenticated;

do $$
declare src text;
begin
  src := pg_get_functiondef('public.complete_pos_sale_impl(jsonb)'::regprocedure);
  src := regexp_replace(
    src,
    'public\.award_loyalty_stamps\(\s*v_customer\s*,\s*svc_id\s*,\s*qty\s*\)',
    'public.award_visit_stamp(v_customer, v_booking, sale_id)',
    'g'
  );
  src := regexp_replace(
    src,
    'public\.award_loyalty_stamps\(\s*sib\.customer_id\s*,\s*sib\.service_id\s*,\s*1\s*\)',
    'public.award_visit_stamp(sib.customer_id, sib.id, sale_id)',
    'g'
  );
  if src like '%award_loyalty_stamps%' then
    raise exception 'complete_pos_sale_impl still awards stamps per service line';
  end if;
  if src not like '%award_visit_stamp%' then
    raise exception 'complete_pos_sale_impl did not switch to award_visit_stamp';
  end if;
  execute src;
end $$;
