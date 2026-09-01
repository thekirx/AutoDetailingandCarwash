-- Owner Revisions P5: vendors, finance quotes, corporate balances; optional expense vendor_id.
-- Investor cannot read corporate_balances (HQ books stay SA/ASA).

begin;

-- ---------------------------------------------------------------------------
-- vendors — supplier directory
-- ---------------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendors_active_name_idx
  on public.vendors (is_active, name);

comment on table public.vendors is
  'Finance supplier directory. SA/ASA finance_write mutate; finance readers select.';

alter table public.expenses
  add column if not exists vendor_id uuid references public.vendors (id) on delete set null;

create index if not exists expenses_vendor_id_idx
  on public.expenses (vendor_id)
  where vendor_id is not null;

-- ---------------------------------------------------------------------------
-- finance_quotes — quotation send log
-- ---------------------------------------------------------------------------
create table if not exists public.finance_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  amount_minor integer not null default 0 check (amount_minor >= 0),
  sent_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists finance_quotes_sent_at_idx
  on public.finance_quotes (sent_at desc);

create index if not exists finance_quotes_customer_idx
  on public.finance_quotes (customer_id, sent_at desc);

comment on table public.finance_quotes is
  'Finance quotation emails sent via /api/send-finance-quote. meta holds to/subject/preview.';

-- ---------------------------------------------------------------------------
-- corporate_balances — owner-entered HQ cash/bank snapshot (not POS drawers)
-- ---------------------------------------------------------------------------
create table if not exists public.corporate_balances (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  period_date date,
  amount_minor integer not null,
  note text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corporate_balances_period_date_idx
  on public.corporate_balances (period_date desc nulls last, created_at desc);

comment on table public.corporate_balances is
  'Manual corporate (HQ) cash/bank balance. Investor must not read. General expenses post to branch slug hq.';

-- ---------------------------------------------------------------------------
-- RLS: vendors
-- ---------------------------------------------------------------------------
alter table public.vendors enable row level security;

drop policy if exists vendors_select on public.vendors;
create policy vendors_select on public.vendors
  for select to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or public.current_user_role() = any (array['admin'::text, 'investor'::text])
  );

drop policy if exists vendors_insert on public.vendors;
create policy vendors_insert on public.vendors
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  );

drop policy if exists vendors_update on public.vendors;
create policy vendors_update on public.vendors
  for update to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  );

drop policy if exists vendors_delete on public.vendors;
create policy vendors_delete on public.vendors
  for delete to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  );

grant select, insert, update, delete on public.vendors to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: finance_quotes
-- ---------------------------------------------------------------------------
alter table public.finance_quotes enable row level security;

drop policy if exists finance_quotes_select on public.finance_quotes;
create policy finance_quotes_select on public.finance_quotes
  for select to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or public.current_user_role() = 'admin'
  );

drop policy if exists finance_quotes_insert on public.finance_quotes;
create policy finance_quotes_insert on public.finance_quotes
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
    or public.current_user_role() = 'admin'
  );

grant select, insert on public.finance_quotes to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: corporate_balances — no investor
-- ---------------------------------------------------------------------------
alter table public.corporate_balances enable row level security;

drop policy if exists corporate_balances_select on public.corporate_balances;
create policy corporate_balances_select on public.corporate_balances
  for select to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
  );

drop policy if exists corporate_balances_insert on public.corporate_balances;
create policy corporate_balances_insert on public.corporate_balances
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  );

drop policy if exists corporate_balances_update on public.corporate_balances;
create policy corporate_balances_update on public.corporate_balances
  for update to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  );

drop policy if exists corporate_balances_delete on public.corporate_balances;
create policy corporate_balances_delete on public.corporate_balances
  for delete to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  );

grant select, insert, update, delete on public.corporate_balances to authenticated;

-- ---------------------------------------------------------------------------
-- Investor must not read HQ books via expenses / daily P&L when branch = hq
-- ---------------------------------------------------------------------------
drop policy if exists expenses_select on public.expenses;
create policy expenses_select
  on public.expenses
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or (public.current_user_role() = 'admin' and public.user_has_branch_access(branch))
    or (
      public.current_user_role() = 'investor'
      and branch is distinct from 'hq'
      and public.user_has_branch_access(branch)
    )
  );

commit;
