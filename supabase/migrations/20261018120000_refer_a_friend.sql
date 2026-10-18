-- Refer a friend — detailing and up only, never carwash (Kirk, 2026-10-17).
-- Approved design: design-mocks/birthday-profile-referral-2026-10-17, handoff
-- docs/handoff/birthday-profile-referral/HANDOFF.md.
--
-- Provisional decisions (client may change them on 2026-10-18), each one place:
--   D1 reward validity        referral_program_settings.validity_days (3)
--   D2 which services count   services.referral_eligible (per service)
--   D4 refund / void          public.unqualify_referral_for_sale()
-- The program ships switched OFF (enabled = false) and with no reward value.
--
-- NOT APPLIED BY CLAUDE. Kirk applies it after review.

begin;

-- Preflight: refuse to run against a database this file has not read. Every
-- table and helper below is assumed; a missing one would only fail later, on
-- the first sale or the first policy check, with this migration committed.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_super_admin'
  ) then
    raise exception 'public.is_super_admin() is missing — the settings write policy depends on it';
  end if;
  if to_regprocedure('public.is_staff()') is null then
    raise exception 'public.is_staff() is missing — the staff read policies and the POS claim depend on it';
  end if;
  if to_regclass('public.services') is null
     or to_regclass('public.sales') is null
     or to_regclass('public.sale_line_items') is null
     or to_regclass('public.customers') is null
     or to_regclass('public.notification_templates') is null then
    raise exception 'refer a friend: services, sales, sale_line_items, customers or notification_templates is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sale_line_items' and column_name = 'line_total_minor'
  ) then
    raise exception 'refer a friend: sale_line_items.line_total_minor is missing — qualification reads it';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- D2: which services count. New services default to false so a new wash never
-- counts by accident; Super Admin turns it on per service.
alter table public.services
  add column if not exists referral_eligible boolean not null default false;

comment on column public.services.referral_eligible is
  'Refer a friend: a paid line of this service qualifies a referral, and a referral reward can be used on it. Detailing and up only, never carwash.';

update public.services
set referral_eligible = true
where referral_eligible = false
  and (
    pay_category = 'detailing'
    or slug like 'ppf%'
    or slug in (
      'interior-detailing',
      'full-exterior-detailing',
      'mobile-detailing',
      'glass-detailing',
      'full-care-package',
      'hakum-custom-package'
    )
  );

-- ---------------------------------------------------------------------------
-- Settings: one row. Every number and reward word the UI shows comes from here.
create table if not exists public.referral_program_settings (
  id smallint primary key default 1,
  enabled boolean not null default false,
  reward_label text not null default 'Detailing reward',
  reward_kind text not null default 'amount_off',
  reward_value integer not null default 0,
  validity_days integer not null default 3,
  yearly_cap integer not null default 5,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint referral_program_settings_single check (id = 1),
  constraint referral_program_settings_kind_ck check (reward_kind in ('amount_off', 'percent_off')),
  constraint referral_program_settings_value_ck check (
    reward_value >= 0 and (reward_kind <> 'percent_off' or reward_value <= 100)
  ),
  constraint referral_program_settings_validity_ck check (validity_days between 1 and 365),
  constraint referral_program_settings_cap_ck check (yearly_cap between 1 and 100),
  constraint referral_program_settings_label_len check (char_length(reward_label) between 1 and 80)
);

comment on column public.referral_program_settings.reward_value is
  'amount_off: centavos off one eligible line. percent_off: 1-100.';

insert into public.referral_program_settings (id) values (1) on conflict (id) do nothing;

alter table public.referral_program_settings enable row level security;

drop policy if exists referral_program_settings_staff_read on public.referral_program_settings;
create policy referral_program_settings_staff_read
  on public.referral_program_settings
  for select
  to authenticated
  using (public.is_staff() or public.is_super_admin());

drop policy if exists referral_program_settings_sa_write on public.referral_program_settings;
create policy referral_program_settings_sa_write
  on public.referral_program_settings
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant select, update on public.referral_program_settings to authenticated;
revoke insert, delete on public.referral_program_settings from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Codes, referrals, rewards.
alter table public.customers
  add column if not exists referral_code text;

create unique index if not exists customers_referral_code_uidx
  on public.customers (referral_code)
  where referral_code is not null;

create table if not exists public.customer_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.customers (id) on delete cascade,
  friend_id uuid not null references public.customers (id) on delete cascade,
  code text not null,
  status text not null default 'pending',
  qualifying_sale_id uuid references public.sales (id) on delete set null,
  qualified_at timestamptz,
  voided_reason text,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint customer_referrals_status_ck check (status in ('pending', 'qualified', 'void')),
  constraint customer_referrals_not_self check (referrer_id <> friend_id)
);

create unique index if not exists customer_referrals_friend_uidx
  on public.customer_referrals (friend_id);
create index if not exists customer_referrals_referrer_idx
  on public.customer_referrals (referrer_id, created_at desc);

create table if not exists public.customer_referral_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  referral_id uuid not null references public.customer_referrals (id) on delete cascade,
  role text not null,
  status text not null default 'available',
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_sale_id uuid references public.sales (id) on delete set null,
  constraint customer_referral_rewards_role_ck check (role in ('referrer', 'friend')),
  constraint customer_referral_rewards_status_ck check (status in ('available', 'claimed', 'expired', 'void'))
);

create unique index if not exists customer_referral_rewards_role_uidx
  on public.customer_referral_rewards (referral_id, role);
create index if not exists customer_referral_rewards_available_idx
  on public.customer_referral_rewards (customer_id, expires_at)
  where status = 'available';

alter table public.customer_referrals enable row level security;
alter table public.customer_referral_rewards enable row level security;

drop policy if exists customer_referrals_own_read on public.customer_referrals;
create policy customer_referrals_own_read
  on public.customer_referrals
  for select
  to authenticated
  using (referrer_id = (select auth.uid()) or friend_id = (select auth.uid()));

drop policy if exists customer_referrals_staff_read on public.customer_referrals;
create policy customer_referrals_staff_read
  on public.customer_referrals
  for select
  to authenticated
  using (public.is_staff());

drop policy if exists customer_referral_rewards_own_read on public.customer_referral_rewards;
create policy customer_referral_rewards_own_read
  on public.customer_referral_rewards
  for select
  to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists customer_referral_rewards_staff_read on public.customer_referral_rewards;
create policy customer_referral_rewards_staff_read
  on public.customer_referral_rewards
  for select
  to authenticated
  using (public.is_staff());

grant select on public.customer_referrals, public.customer_referral_rewards to authenticated;
revoke insert, update, delete on public.customer_referrals, public.customer_referral_rewards
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Qualification: the friend's first PAID sale with a referral_eligible service
-- line that cost something (free award lines are 0) qualifies the referral and
-- grants both rewards. Idempotent; safe to call per inserted line.
create or replace function public.qualify_referral_for_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  s public.sales%rowtype;
  r public.customer_referrals%rowtype;
  cfg public.referral_program_settings%rowtype;
  used integer;
  expires timestamptz;
begin
  select * into s from public.sales where id = p_sale_id;
  if s.id is null or s.customer_id is null or s.status <> 'paid' then
    return;
  end if;

  select * into r
  from public.customer_referrals
  where friend_id = s.customer_id and status = 'pending'
  for update;
  if r.id is null or coalesce(s.occurred_at, s.created_at) < r.created_at then
    return;
  end if;

  if not exists (
    select 1
    from public.sale_line_items li
    join public.services sv on sv.id = li.service_id
    where li.sale_id = s.id
      and sv.referral_eligible
      and coalesce(li.line_total_minor, li.unit_price_minor * greatest(li.quantity, 1), 0) > 0
  ) then
    return;
  end if;

  select * into cfg from public.referral_program_settings where id = 1;
  if cfg.id is null or not cfg.enabled then
    return;
  end if;

  -- Yearly cap per referrer (Manila calendar year).
  select count(*) into used
  from public.customer_referrals q
  where q.referrer_id = r.referrer_id
    and q.status = 'qualified'
    and extract(year from (q.qualified_at at time zone 'Asia/Manila'))
        = extract(year from (now() at time zone 'Asia/Manila'));
  if used >= cfg.yearly_cap then
    return;
  end if;

  expires := now() + make_interval(days => cfg.validity_days);

  update public.customer_referrals
  set status = 'qualified', qualifying_sale_id = s.id, qualified_at = now(), voided_reason = null
  where id = r.id;

  insert into public.customer_referral_rewards (customer_id, referral_id, role, expires_at)
  values (r.referrer_id, r.id, 'referrer', expires), (r.friend_id, r.id, 'friend', expires)
  on conflict (referral_id, role) do update
    set status = 'available', granted_at = now(), expires_at = excluded.expires_at,
        claimed_at = null, claimed_sale_id = null
    where public.customer_referral_rewards.status = 'void';
end;
$$;

-- D4: the transaction must go through. A refunded/voided qualifying sale sends
-- the referral back to pending (the friend's next paid detailing can still
-- qualify) and voids rewards nobody has used. A reward already claimed on
-- another sale is left alone and noted for staff.
create or replace function public.unqualify_referral_for_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r public.customer_referrals%rowtype;
  claimed integer;
begin
  select * into r from public.customer_referrals where qualifying_sale_id = p_sale_id for update;
  if r.id is null then
    return;
  end if;

  update public.customer_referral_rewards
  set status = 'void'
  where referral_id = r.id and status = 'available';

  select count(*) into claimed
  from public.customer_referral_rewards
  where referral_id = r.id and status = 'claimed';

  update public.customer_referrals
  set status = 'pending',
      qualifying_sale_id = null,
      qualified_at = null,
      notified_at = null,
      voided_reason = case when claimed > 0
        then 'Qualifying sale refunded/voided after a reward was used'
        else 'Qualifying sale refunded/voided' end
  where id = r.id;
end;
$$;

create or replace function public.sale_line_items_qualify_referral()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.service_id is not null then
    perform public.qualify_referral_for_sale(new.sale_id);
  end if;
  return null;
end;
$$;

drop trigger if exists sale_line_items_qualify_referral on public.sale_line_items;
create trigger sale_line_items_qualify_referral
  after insert on public.sale_line_items
  for each row execute function public.sale_line_items_qualify_referral();

create or replace function public.sales_referral_status_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status in ('voided', 'refunded') and old.status is distinct from new.status then
    perform public.unqualify_referral_for_sale(new.id);
  elsif new.status = 'paid' and old.status is distinct from new.status then
    perform public.qualify_referral_for_sale(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists sales_referral_status_change on public.sales;
create trigger sales_referral_status_change
  after update of status on public.sales
  for each row execute function public.sales_referral_status_change();

revoke all on function public.qualify_referral_for_sale(uuid) from public, anon, authenticated;
revoke all on function public.unqualify_referral_for_sale(uuid) from public, anon, authenticated;
revoke all on function public.sale_line_items_qualify_referral() from public, anon, authenticated;
revoke all on function public.sales_referral_status_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- POS claim: staff mark one reward used on a paid sale. Re-checks on the
-- server that the sale belongs to the customer and has an eligible paid line,
-- so a reward can never be consumed on a carwash-only sale.
create or replace function public.claim_referral_reward(p_customer_id uuid, p_reward_id uuid, p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  rw public.customer_referral_rewards%rowtype;
  s public.sales%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;

  select * into rw
  from public.customer_referral_rewards
  where id = p_reward_id and customer_id = p_customer_id
  for update;
  if rw.id is null or rw.status <> 'available' or rw.expires_at <= clock_timestamp() then
    return jsonb_build_object('ok', false, 'error', 'No refer-a-friend reward to use');
  end if;

  select * into s from public.sales where id = p_sale_id;
  if s.id is null or s.customer_id is distinct from p_customer_id or s.status <> 'paid' then
    return jsonb_build_object('ok', false, 'error', 'Sale not found for this customer');
  end if;

  if not exists (
    select 1
    from public.sale_line_items li
    join public.services sv on sv.id = li.service_id
    where li.sale_id = s.id and sv.referral_eligible
  ) then
    return jsonb_build_object('ok', false, 'error', 'Refer-a-friend rewards are for detailing and up, not carwash');
  end if;

  update public.customer_referral_rewards
  set status = 'claimed', claimed_at = now(), claimed_sale_id = s.id
  where id = rw.id;

  return jsonb_build_object('ok', true, 'reward_id', rw.id);
end;
$$;

revoke all on function public.claim_referral_reward(uuid, uuid, uuid) from public, anon;
grant execute on function public.claim_referral_reward(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Push/SMS copy for the unlock, SA-editable like birthday.greeting.
insert into public.notification_templates (key, title, body, sms_body, enabled)
values (
  'referral.reward',
  'Your refer-a-friend reward is ready',
  '{name}, your refer-a-friend reward is in Rewards. Use it on a detailing service or higher within {days} days.',
  'Hakum Auto Care: {name}, your refer-a-friend reward is ready. Use it on detailing or higher within {days} days.',
  true
)
on conflict (key) do nothing;

commit;
