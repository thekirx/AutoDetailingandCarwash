-- W6: ASA expense reports → expenses on submit.

create table if not exists public.expense_reports (
  id uuid primary key default gen_random_uuid(),
  branch text not null references public.branches(slug) on update cascade on delete restrict,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  title text,
  review_note text,
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.expense_report_lines (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.expense_reports(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  notes text,
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expense_reports_period_idx
  on public.expense_reports (period_start, period_end desc);
create index if not exists expense_report_lines_report_idx
  on public.expense_report_lines (report_id);

alter table public.expense_reports enable row level security;
alter table public.expense_report_lines enable row level security;

create policy expense_reports_select
  on public.expense_reports for select to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or public.asa_has_grant('finance_write')
  );

create policy expense_reports_write
  on public.expense_reports for all to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  );

create policy expense_report_lines_select
  on public.expense_report_lines for select to authenticated
  using (
    exists (
      select 1 from public.expense_reports r
      where r.id = report_id
        and (
          public.is_super_admin()
          or public.asa_has_grant('finance_view')
          or public.asa_has_grant('finance_write')
        )
    )
  );

create policy expense_report_lines_write
  on public.expense_report_lines for all to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
  );

create or replace function public.submit_expense_report(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  v_id uuid := (payload->>'id')::uuid;
  v_status text;
  line record;
  v_expense uuid;
  v_kind text;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich'
     and not (caller_role = 'assistant_super_admin' and public.asa_has_grant('finance_write')) then
    raise exception using errcode = '42501', message = 'Only SA or ASA finance write may submit expense reports';
  end if;
  if v_id is null then raise exception 'Report id required'; end if;

  select status into v_status from public.expense_reports where id = v_id for update;
  if v_status is null then raise exception 'Expense report not found'; end if;
  if v_status not in ('draft', 'rejected') then
    raise exception 'Report already submitted';
  end if;
  if not exists (select 1 from public.expense_report_lines where report_id = v_id) then
    raise exception 'Add at least one line before submit';
  end if;

  for line in
    select l.*, c.name as category_name, c.kind as category_kind, r.branch
    from public.expense_report_lines l
    join public.expense_categories c on c.id = l.category_id
    join public.expense_reports r on r.id = l.report_id
    where l.report_id = v_id
  loop
    if line.expense_id is not null then
      continue;
    end if;
    v_kind := 'other';
    insert into public.expenses (
      title, description, quantity, unit_cost_minor, total_minor,
      branch, category_id, status, expense_kind, created_by
    ) values (
      coalesce(line.notes, line.category_name, 'Expense report line'),
      concat('expense_report:', v_id::text, ':', line.id::text),
      1,
      line.amount_minor,
      line.amount_minor,
      line.branch,
      line.category_id,
      'pending_approval',
      v_kind,
      caller
    ) returning id into v_expense;
    update public.expense_report_lines set expense_id = v_expense where id = line.id;
  end loop;

  update public.expense_reports set
    status = 'submitted',
    submitted_by = caller,
    submitted_at = now(),
    updated_at = now()
  where id = v_id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (caller, caller_role, 'expense_report.submit', 'expense_reports', v_id::text, 'Submitted expense report', '{}'::jsonb);

  return jsonb_build_object('id', v_id, 'status', 'submitted');
end;
$$;

revoke all on function public.submit_expense_report(jsonb) from public, anon;
grant execute on function public.submit_expense_report(jsonb) to authenticated;

create or replace function public.review_expense_report(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  v_id uuid := (payload->>'id')::uuid;
  v_action text := lower(coalesce(payload->>'action', ''));
  v_note text := nullif(trim(coalesce(payload->>'review_note', '')), '');
  v_status text;
  v_next text;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich' then
    raise exception using errcode = '42501', message = 'Only Super Admin may approve expense reports';
  end if;
  if v_action not in ('approve', 'reject') then raise exception 'action must be approve or reject'; end if;
  if v_action = 'reject' and v_note is null then raise exception 'Reject requires a note'; end if;

  select status into v_status from public.expense_reports where id = v_id for update;
  if v_status is null then raise exception 'Expense report not found'; end if;
  if v_status is distinct from 'submitted' then raise exception 'Only submitted reports can be reviewed'; end if;
  v_next := case when v_action = 'approve' then 'approved' else 'rejected' end;

  if v_action = 'approve' then
    update public.expenses e
    set status = 'paid', paid_by = caller, updated_at = now()
    from public.expense_report_lines l
    where l.report_id = v_id and l.expense_id = e.id and e.status is distinct from 'paid';
  end if;

  update public.expense_reports set
    status = v_next,
    review_note = coalesce(v_note, review_note),
    reviewed_by = caller,
    reviewed_at = now(),
    updated_at = now()
  where id = v_id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (caller, caller_role, 'expense_report.review', 'expense_reports', v_id::text, 'Reviewed expense report', jsonb_build_object('action', v_action));

  return jsonb_build_object('id', v_id, 'status', v_next);
end;
$$;

revoke all on function public.review_expense_report(jsonb) from public, anon;
grant execute on function public.review_expense_report(jsonb) to authenticated;
