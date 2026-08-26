-- W1: End-of-shift close reports (POS baseline + BA override + SA review)

create table if not exists public.shift_close_field_config (
  field_key text primary key,
  label text not null,
  allow_override boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.shift_close_reports (
  id uuid primary key default gen_random_uuid(),
  branch text not null references public.branches(slug) on update cascade on delete restrict,
  business_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'accepted', 'rejected', 'locked')),
  pos_baseline jsonb not null default '{}'::jsonb,
  submitted jsonb not null default '{}'::jsonb,
  override_reasons jsonb not null default '{}'::jsonb,
  review_note text,
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shift_close_reports_branch_date_open_uidx
  on public.shift_close_reports (branch, business_date)
  where status in ('draft', 'submitted', 'accepted', 'locked');

create index if not exists shift_close_reports_status_idx
  on public.shift_close_reports (status, business_date desc);

create index if not exists shift_close_reports_branch_date_idx
  on public.shift_close_reports (branch, business_date desc);

alter table public.shift_close_field_config enable row level security;
alter table public.shift_close_reports enable row level security;

-- Field config: staff read; SA write
drop policy if exists shift_close_field_config_select on public.shift_close_field_config;
create policy shift_close_field_config_select
  on public.shift_close_field_config for select to authenticated
  using (public.is_staff());

drop policy if exists shift_close_field_config_write on public.shift_close_field_config;
create policy shift_close_field_config_insert
  on public.shift_close_field_config for insert to authenticated
  with check (public.is_super_admin());
create policy shift_close_field_config_update
  on public.shift_close_field_config for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy shift_close_field_config_delete
  on public.shift_close_field_config for delete to authenticated
  using (public.is_super_admin());

-- Reports select
drop policy if exists shift_close_reports_select on public.shift_close_reports;
create policy shift_close_reports_select
  on public.shift_close_reports for select to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch)
    )
  );

drop policy if exists shift_close_reports_insert on public.shift_close_reports;
create policy shift_close_reports_insert
  on public.shift_close_reports for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch)
    )
  );

drop policy if exists shift_close_reports_update on public.shift_close_reports;
create policy shift_close_reports_update
  on public.shift_close_reports for update to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch)
      and status in ('draft', 'submitted', 'rejected')
    )
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch)
    )
  );

insert into public.shift_close_field_config (field_key, label, allow_override, sort_order) values
  ('square_sales_minor', 'Square sales', true, 10),
  ('total_gcash_minor', 'Total GCash', true, 20),
  ('credit_card_minor', 'Credit card', true, 30),
  ('total_expenses_minor', 'Total expenses', true, 40),
  ('total_cash_left_minor', 'Total cash left', true, 50),
  ('car_wash_sales_minor', 'Car wash sales', true, 60),
  ('ceramic_coating_sales_minor', 'Ceramic coating sales', true, 70),
  ('ppf_sales_minor', 'PPF sales', true, 80),
  ('ceramic_tint_sales_minor', 'Ceramic tint sales', true, 90),
  ('refreshment_sales_minor', 'Refreshment sales', true, 100),
  ('car_accessories_minor', 'Car accessories', true, 110),
  ('hakum_clothing_minor', 'Hakum clothing', true, 120),
  ('carwash_salary_minor', 'Carwash salary', true, 130),
  ('detailer_salary_minor', 'Detailer salary', true, 140),
  ('tinter_salary_minor', 'Tinter salary', true, 150)
on conflict (field_key) do nothing;

-- Submit: BA/SA; server trusts client baseline only after client sends recomputed POS snapshot
-- (app recomputes; RPC stores and validates overrides)
create or replace function public.submit_shift_close(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  v_branch text := nullif(payload->>'branch', '');
  v_date date := (payload->>'business_date')::date;
  v_baseline jsonb := coalesce(payload->'pos_baseline', '{}'::jsonb);
  v_submitted jsonb := coalesce(payload->'submitted', '{}'::jsonb);
  v_reasons jsonb := coalesce(payload->'override_reasons', '{}'::jsonb);
  v_id uuid;
  v_status text;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich'
     and caller_role is distinct from 'admin' then
    raise exception using errcode = '42501', message = 'Only Branch Admin or Super Admin may submit shift close';
  end if;
  if v_branch is null or v_date is null then
    raise exception 'Branch and business date are required';
  end if;
  if caller_role = 'admin' and not public.user_has_branch_access(v_branch) then
    raise exception using errcode = '42501', message = 'Shift close is limited to your branch';
  end if;
  if jsonb_typeof(v_baseline) is distinct from 'object'
     or jsonb_typeof(v_submitted) is distinct from 'object' then
    raise exception 'Invalid baseline or submitted payload';
  end if;

  select id, status into v_id, v_status
  from public.shift_close_reports
  where branch = v_branch and business_date = v_date
    and status in ('draft', 'submitted', 'accepted', 'locked', 'rejected')
  order by case status
    when 'locked' then 0 when 'accepted' then 1 when 'submitted' then 2
    when 'draft' then 3 else 4 end
  limit 1;

  if v_status in ('accepted', 'locked') then
    raise exception 'This day is already % — unlock/reject before resubmitting', v_status;
  end if;

  if v_id is null then
    insert into public.shift_close_reports (
      branch, business_date, status, pos_baseline, submitted, override_reasons,
      submitted_by, submitted_at, updated_at
    ) values (
      v_branch, v_date, 'submitted', v_baseline, v_submitted, v_reasons,
      caller, now(), now()
    )
    returning id into v_id;
  else
    update public.shift_close_reports set
      status = 'submitted',
      pos_baseline = v_baseline,
      submitted = v_submitted,
      override_reasons = v_reasons,
      submitted_by = caller,
      submitted_at = now(),
      review_note = null,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
    where id = v_id;
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller, caller_role, 'shift_close.submit', 'shift_close_reports', v_id::text,
    'Submitted end-of-shift close',
    jsonb_build_object('branch', v_branch, 'business_date', v_date)
  );

  return jsonb_build_object('id', v_id, 'status', 'submitted');
end;
$$;

revoke all on function public.submit_shift_close(jsonb) from public, anon;
grant execute on function public.submit_shift_close(jsonb) to authenticated;

create or replace function public.review_shift_close(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  v_id uuid := (payload->>'id')::uuid;
  v_action text := lower(nullif(trim(coalesce(payload->>'action', '')), ''));
  v_note text := nullif(trim(coalesce(payload->>'review_note', '')), '');
  v_status text;
  v_next text;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich'
     and not (
       caller_role = 'assistant_super_admin'
       and public.asa_has_grant('finance_view')
     ) then
    raise exception using errcode = '42501',
      message = 'Only Super Admin or ASA with finance view may review shift close';
  end if;
  if v_id is null or v_action not in ('accept', 'reject', 'lock') then
    raise exception 'id and action (accept|reject|lock) are required';
  end if;
  if v_action = 'reject' and v_note is null then
    raise exception 'Reject requires a review note';
  end if;

  select status into v_status from public.shift_close_reports where id = v_id for update;
  if v_status is null then
    raise exception 'Shift close report not found';
  end if;
  if v_status = 'locked' and v_action is distinct from 'lock' then
    raise exception 'Report is locked';
  end if;
  if v_action = 'accept' then v_next := 'accepted';
  elsif v_action = 'reject' then v_next := 'rejected';
  else v_next := 'locked';
  end if;
  if v_action = 'lock' and v_status is distinct from 'accepted' and v_status is distinct from 'locked' then
    raise exception 'Only accepted reports can be locked';
  end if;
  if v_action in ('accept', 'reject') and v_status is distinct from 'submitted' then
    raise exception 'Only submitted reports can be accepted or rejected';
  end if;

  update public.shift_close_reports set
    status = v_next,
    review_note = coalesce(v_note, review_note),
    reviewed_by = caller,
    reviewed_at = now(),
    updated_at = now()
  where id = v_id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller, caller_role, 'shift_close.review', 'shift_close_reports', v_id::text,
    'Reviewed end-of-shift close',
    jsonb_build_object('action', v_action, 'status', v_next)
  );

  return jsonb_build_object('id', v_id, 'status', v_next);
end;
$$;

revoke all on function public.review_shift_close(jsonb) from public, anon;
grant execute on function public.review_shift_close(jsonb) to authenticated;
