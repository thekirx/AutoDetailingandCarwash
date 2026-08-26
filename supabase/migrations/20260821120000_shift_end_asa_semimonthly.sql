-- Shift end clock + ASA submit; semi-monthly commission windows (15th / month-end).

alter table public.shift_close_reports
  add column if not exists shift_ended_at timestamptz;

comment on column public.shift_close_reports.shift_ended_at is
  'When the bay actually closed — BA/ASA/SA set this; not tied to static branch hours.';

alter table public.compensation_settings
  drop constraint if exists compensation_settings_payout_frequency_check;

alter table public.compensation_settings
  add constraint compensation_settings_payout_frequency_check
  check (payout_frequency in ('daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'custom'));

alter table public.payroll_runs
  drop constraint if exists payroll_runs_frequency_check;

alter table public.payroll_runs
  add constraint payroll_runs_frequency_check
  check (frequency in ('daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'custom'));

update public.compensation_settings
set payout_frequency = 'semimonthly'
where id = 1 and payout_frequency = 'weekly';

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
  v_ended timestamptz := nullif(payload->>'shift_ended_at', '')::timestamptz;
  v_baseline jsonb := coalesce(payload->'pos_baseline', '{}'::jsonb);
  v_submitted jsonb := coalesce(payload->'submitted', '{}'::jsonb);
  v_reasons jsonb := coalesce(payload->'override_reasons', '{}'::jsonb);
  v_id uuid;
  v_status text;
  v_asa_ok boolean := false;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  caller_role := public.current_user_role();
  v_asa_ok := caller_role = 'assistant_super_admin'
    and (
      public.asa_has_grant('pos')
      or public.asa_has_grant('finance_write')
    );
  if caller_role is distinct from 'BossMich'
     and caller_role is distinct from 'admin'
     and not v_asa_ok then
    raise exception using errcode = '42501',
      message = 'Only Branch Admin, Super Admin, or ASA (POS) may submit shift close';
  end if;
  if v_branch is null or v_date is null then
    raise exception 'Branch and business date are required';
  end if;
  if v_ended is null then
    raise exception 'Shift end time is required';
  end if;
  if caller_role in ('admin', 'assistant_super_admin')
     and not public.user_has_branch_access(v_branch) then
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
      branch, business_date, status, shift_ended_at, pos_baseline, submitted, override_reasons,
      submitted_by, submitted_at, updated_at
    ) values (
      v_branch, v_date, 'submitted', v_ended, v_baseline, v_submitted, v_reasons,
      caller, now(), now()
    )
    returning id into v_id;
  else
    update public.shift_close_reports set
      status = 'submitted',
      shift_ended_at = v_ended,
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
    jsonb_build_object(
      'branch', v_branch,
      'business_date', v_date,
      'shift_ended_at', v_ended
    )
  );

  return jsonb_build_object('id', v_id, 'status', 'submitted', 'shift_ended_at', v_ended);
end;
$$;

revoke all on function public.submit_shift_close(jsonb) from public, anon;
grant execute on function public.submit_shift_close(jsonb) to authenticated;
