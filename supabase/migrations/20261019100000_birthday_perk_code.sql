-- Birthday perk becomes a 7-day code. The birthdate locks after the first save.
-- Staff can see that a perk exists. They cannot read the code column.

alter table public.customer_birthday_perks
  add column if not exists code text;

create unique index if not exists customer_birthday_perks_code_uidx
  on public.customer_birthday_perks (code)
  where code is not null;

do $$
declare
  rec record;
  minted text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
  n int;
begin
  for rec in select id from public.customer_birthday_perks where code is null loop
    for n in 1..8 loop
      minted := 'BD';
      for i in 1..4 loop
        minted := minted || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      begin
        update public.customer_birthday_perks set code = minted where id = rec.id and code is null;
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
  end loop;
end $$;

revoke select on public.customer_birthday_perks from authenticated;
grant select (
  id,
  customer_id,
  perk_year,
  status,
  granted_at,
  expires_at,
  claimed_at,
  claimed_sale_id,
  greeting_sent_at,
  created_at
) on public.customer_birthday_perks to authenticated;

create or replace function public.customers_lock_birthday()
returns trigger
language plpgsql
as $$
begin
  if old.date_of_birth is not null and new.date_of_birth is distinct from old.date_of_birth then
    raise exception 'Birthday is locked after the first save.';
  end if;
  return new;
end;
$$;

drop trigger if exists customers_lock_birthday on public.customers;
create trigger customers_lock_birthday
  before update of date_of_birth on public.customers
  for each row
  execute function public.customers_lock_birthday();

create or replace function public.birthday_code_matches(p_customer_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if auth.uid() is distinct from p_customer_id then
    if not exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role::text in ('BossMich', 'assistant_super_admin', 'admin', 'team_lead')
    ) then
      raise exception 'forbidden';
    end if;
  end if;

  normalized := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if normalized !~ '^BD[A-Z2-9]{4}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.customer_birthday_perks
    where customer_id = p_customer_id
      and status = 'available'
      and expires_at > clock_timestamp()
      and code = normalized
  );
end;
$$;

revoke all on function public.birthday_code_matches(uuid, text) from public, anon;
grant execute on function public.birthday_code_matches(uuid, text) to authenticated;

drop function if exists public.claim_birthday_perk(uuid, uuid);

create function public.claim_birthday_perk(
  p_customer_id uuid,
  p_sale_id uuid default null,
  p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  perk public.customer_birthday_perks%rowtype;
  normalized text;
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

  normalized := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if normalized !~ '^BD[A-Z2-9]{4}$' then
    return jsonb_build_object('ok', false, 'error', 'Type the birthday code before the service is free.');
  end if;

  select * into perk
  from public.customer_birthday_perks
  where customer_id = p_customer_id
    and status = 'available'
    and expires_at > clock_timestamp()
    and code = normalized
  order by perk_year desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'That birthday code does not match this customer.');
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

revoke all on function public.claim_birthday_perk(uuid, uuid, text) from public, anon;
grant execute on function public.claim_birthday_perk(uuid, uuid, text) to authenticated;
