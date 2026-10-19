-- Crew day card: typed sheet salary pool + current bay job + failed QA (branch today).
-- Crew cannot SELECT daily_sheets (RLS); this security-definer snapshot is the read path.

create or replace function public.crew_day_card_snapshot(p_branch text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  staff public.staff_profiles%rowtype;
  today_key date := (timezone('Asia/Manila', now()))::date;
  sheet_id uuid;
  sheet_status text;
  salaries int := 0;
  failed int := 0;
  v_task text;
  v_assign_status text;
  v_plate text;
  v_qn int;
  v_svc text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into staff
  from public.staff_profiles
  where id = auth.uid() and is_active = true;
  if not found then
    raise exception 'forbidden';
  end if;

  if p_branch is null or length(trim(p_branch)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Pick a branch.');
  end if;

  if not public.user_has_branch_access(p_branch) then
    raise exception 'forbidden';
  end if;

  select s.id, s.status::text
  into sheet_id, sheet_status
  from public.daily_sheets s
  where s.branch = p_branch
    and s.business_date = today_key
  limit 1;

  if sheet_id is not null then
    select coalesce(sum(l.amount_minor), 0)::int
    into salaries
    from public.daily_sheet_lines l
    where l.sheet_id = sheet_id
      and l.kind = 'salary';
  end if;

  select count(*)::int into failed
  from (
    select distinct coalesce(b.visit_group_id::text, b.id::text) as visit_key
    from public.bookings b
    where b.branch = p_branch
      and b.redo_at is not null
      and (timezone('Asia/Manila', b.redo_at))::date = today_key
  ) hits;

  select
    qa.task_name,
    qa.status::text,
    b.vehicle_plate,
    b.queue_number,
    s.name
  into v_task, v_assign_status, v_plate, v_qn, v_svc
  from public.queue_assignments qa
  join public.bookings b on b.id = qa.booking_id
  left join public.services s on s.id = b.service_id
  where qa.staff_id = staff.id
    and qa.status in ('active', 'pending')
    and b.branch = p_branch
  order by case when qa.status = 'active' then 0 else 1 end, qa.created_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'business_date', today_key,
    'sheet_status', sheet_status,
    'sheet_salaries_minor', salaries,
    'failed_qa_count', failed,
    'current_car', case
      when v_assign_status is not null then jsonb_build_object(
        'task_name', v_task,
        'status', v_assign_status,
        'vehicle_plate', v_plate,
        'queue_number', v_qn,
        'service_name', v_svc
      )
      else null
    end
  );
end;
$$;

revoke all on function public.crew_day_card_snapshot(text) from public, anon;
grant execute on function public.crew_day_card_snapshot(text) to authenticated;
