-- Birthday free-service perk + SA-editable system notification templates.
-- query: birthday lookup by month/day; perk claim is one row per customer/year.

begin;

alter table public.customers
  add column if not exists date_of_birth date;

comment on column public.customers.date_of_birth is
  'Customer birthday (date only). Used for greeting push/SMS and the yearly free-service perk.';

-- Expression index on month/day so the daily greeting scan does not seq-scan customers.
create index if not exists customers_birthday_md_idx
  on public.customers (
    (extract(month from date_of_birth)::smallint),
    (extract(day from date_of_birth)::smallint)
  )
  where date_of_birth is not null and coalesce(is_archived, false) = false;

create table if not exists public.customer_birthday_perks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  perk_year integer not null,
  status text not null default 'available',
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_sale_id uuid,
  greeting_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customer_birthday_perks_year_ck
    check (perk_year between 2000 and 2100),
  constraint customer_birthday_perks_status_ck
    check (status in ('available', 'claimed', 'expired'))
);

create unique index if not exists customer_birthday_perks_year_uidx
  on public.customer_birthday_perks (customer_id, perk_year);

create index if not exists customer_birthday_perks_available_idx
  on public.customer_birthday_perks (customer_id, perk_year desc)
  where status = 'available';

alter table public.customer_birthday_perks enable row level security;

drop policy if exists customer_birthday_perks_own_read on public.customer_birthday_perks;
create policy customer_birthday_perks_own_read
  on public.customer_birthday_perks
  for select
  to authenticated
  using (customer_id = auth.uid());

drop policy if exists customer_birthday_perks_staff_read on public.customer_birthday_perks;
create policy customer_birthday_perks_staff_read
  on public.customer_birthday_perks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
    )
  );

grant select on public.customer_birthday_perks to authenticated;
revoke insert, update, delete on public.customer_birthday_perks from public, anon, authenticated;

create table if not exists public.notification_templates (
  key text primary key,
  title text,
  body text,
  sms_body text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint notification_templates_key_ck
    check (key ~ '^[a-z][a-z0-9_.]{2,63}$'),
  constraint notification_templates_title_len
    check (title is null or char_length(title) <= 160),
  constraint notification_templates_body_len
    check (body is null or char_length(body) <= 1000),
  constraint notification_templates_sms_len
    check (sms_body is null or char_length(sms_body) <= 1000)
);

comment on table public.notification_templates is
  'SA overrides for system push/SMS copy. Missing keys fall back to code defaults.';

alter table public.notification_templates enable row level security;

drop policy if exists notification_templates_staff_read on public.notification_templates;
create policy notification_templates_staff_read
  on public.notification_templates
  for select
  to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin', 'marketing')
    )
  );

grant select on public.notification_templates to authenticated;
revoke insert, update, delete on public.notification_templates from public, anon, authenticated;

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

-- Uses customers_birthday_md_idx (extract month/day). Service-role cron + SA run.
create or replace function public.list_birthday_customers(p_month smallint, p_day smallint)
returns table (id uuid, full_name text, phone text, date_of_birth date)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.full_name, c.phone, c.date_of_birth
  from public.customers c
  where c.role = 'customer'
    and coalesce(c.is_archived, false) = false
    and c.date_of_birth is not null
    and extract(month from c.date_of_birth)::smallint = p_month
    and extract(day from c.date_of_birth)::smallint = p_day;
$$;

revoke all on function public.list_birthday_customers(smallint, smallint) from public, anon, authenticated;
grant execute on function public.list_birthday_customers(smallint, smallint) to service_role;

commit;
