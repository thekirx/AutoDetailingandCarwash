-- Close write paths any signed-in user (incl. read-only investors) could hit directly.
-- Both counters below are only called from security-definer code (booking trigger / complete_pos_sale).
revoke execute on function public.assign_persistent_queue_number(text) from authenticated;
revoke execute on function public.redeem_pos_loyalty_awards(jsonb) from authenticated;

-- Birthday perk on behalf of a customer = POS checkout roles only (matches complete_pos_sale).
create or replace function public.claim_birthday_perk(p_customer_id uuid, p_sale_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  perk public.customer_birthday_perks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if auth.uid() is distinct from p_customer_id then
    if not exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role::text in ('BossMich', 'assistant_super_admin', 'admin')
    ) then
      raise exception 'forbidden';
    end if;
  end if;

  if p_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'customer required');
  end if;

  select * into perk
  from public.customer_birthday_perks
  where customer_id = p_customer_id
    and status = 'available'
    and expires_at > clock_timestamp()
  order by perk_year desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No birthday perk to claim');
  end if;

  update public.customer_birthday_perks
  set
    status = 'claimed',
    claimed_at = clock_timestamp(),
    claimed_sale_id = p_sale_id
  where id = perk.id;

  return jsonb_build_object('ok', true, 'perk_id', perk.id, 'perk_year', perk.perk_year);
end;
$$;

revoke all on function public.claim_birthday_perk(uuid, uuid) from public, anon;
grant execute on function public.claim_birthday_perk(uuid, uuid) to authenticated;
