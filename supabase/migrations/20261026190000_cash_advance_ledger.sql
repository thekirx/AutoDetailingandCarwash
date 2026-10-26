-- Read path for cash-advance remaining balance.
-- Crew cannot SELECT daily_sheets. This function returns only the caller's own
-- given/paid-back lines, or the branch list for people who already run POS or the sheet.
-- ponytail: 400 newest movements. A branch that outgrows that needs a paged RPC.

create or replace function public.cash_advance_ledger(p_branch text default null, p_staff uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text := public.current_user_role();
  v_staff uuid := p_staff;
  v_branch text := nullif(trim(coalesce(p_branch, '')), '');
  v_all boolean := false;
  v_processor boolean := false;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from public.staff_profiles where id = auth.uid() and is_active = true) then
    raise exception 'forbidden';
  end if;

  if v_branch = 'all' then
    if v_role <> 'BossMich' then
      raise exception 'forbidden';
    end if;
    v_all := true;
    v_branch := null;
    v_processor := true;
  else
    v_processor := v_role = 'BossMich'
      or (v_role in ('admin', 'operations_lead') and v_branch is not null and public.user_has_branch_access(v_branch))
      or (
        v_role = 'assistant_super_admin'
        and v_branch is not null
        and public.user_has_branch_access(v_branch)
        and (
          public.asa_has_grant('pos')
          or public.asa_has_grant('finance_view')
          or public.asa_has_grant('finance_write')
        )
      );
  end if;

  if v_staff is not null and v_staff is distinct from auth.uid() and not v_processor then
    raise exception 'forbidden';
  end if;

  if not v_processor then
    v_staff := auth.uid();
    v_branch := null;
    v_all := false;
  elsif v_staff is null and not v_all and v_branch is null then
    raise exception 'Pick a branch.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.business_date desc), '[]'::jsonb)
  into v_rows
  from (
    select
      l.staff_id,
      sp.full_name,
      s.business_date,
      s.branch,
      s.id as sheet_id,
      l.kind,
      l.amount_minor
    from public.daily_sheet_lines l
    join public.daily_sheets s on s.id = l.sheet_id
    left join public.staff_profiles sp on sp.id = l.staff_id
    where l.kind in ('ca_release', 'ca_repay')
      and l.amount_minor > 0
      and l.staff_id is not null
      and (v_staff is null or l.staff_id = v_staff)
      and (v_branch is null or s.branch = v_branch)
    order by s.business_date desc, l.sort
    limit 400
  ) x;

  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$$;

revoke all on function public.cash_advance_ledger(text, uuid) from public, anon;
grant execute on function public.cash_advance_ledger(text, uuid) to authenticated;
