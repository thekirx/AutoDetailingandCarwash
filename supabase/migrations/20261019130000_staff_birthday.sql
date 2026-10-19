-- Staff birthdays: profile field (locked after first save), month board, day-of list.

alter table public.staff_profiles
  add column if not exists date_of_birth date;

alter table public.staff_profiles
  add column if not exists date_of_birth_locked_at timestamptz;

comment on column public.staff_profiles.date_of_birth is 'Employee birthday; locks after first save.';

create or replace function public.save_own_staff_birthday(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  staff public.staff_profiles%rowtype;
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

  if p_date is null then
    return jsonb_build_object('ok', false, 'error', 'Pick your date of birth.');
  end if;

  if p_date > (timezone('Asia/Manila', now()))::date then
    return jsonb_build_object('ok', false, 'error', 'Birthday cannot be in the future.');
  end if;

  if staff.date_of_birth is not null and staff.date_of_birth_locked_at is not null then
    if staff.date_of_birth is distinct from p_date then
      return jsonb_build_object('ok', false, 'error', 'Birthday is locked. Ask Super Admin if it must change.');
    end if;
    return jsonb_build_object('ok', true, 'date_of_birth', staff.date_of_birth, 'locked', true);
  end if;

  update public.staff_profiles
  set
    date_of_birth = p_date,
    date_of_birth_locked_at = coalesce(date_of_birth_locked_at, clock_timestamp()),
    updated_at = clock_timestamp()
  where id = staff.id;

  return jsonb_build_object('ok', true, 'date_of_birth', p_date, 'locked', true);
end;
$$;

create or replace function public.staff_birthdays_month(p_branch text, p_month int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today_key date := (timezone('Asia/Manila', now()))::date;
  month_n int := coalesce(p_month, extract(month from today_key)::int);
  rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.staff_profiles sp
    where sp.id = auth.uid() and sp.is_active = true
  ) then
    raise exception 'forbidden';
  end if;

  if p_branch is null or length(trim(p_branch)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Pick a branch.');
  end if;

  if not public.user_has_branch_access(p_branch) then
    raise exception 'forbidden';
  end if;

  if month_n < 1 or month_n > 12 then
    return jsonb_build_object('ok', false, 'error', 'Invalid month.');
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.day_of_month, t.full_name), '[]'::jsonb)
  into rows
  from (
    select
      sp.id,
      sp.full_name,
      sp.role::text as role,
      extract(day from sp.date_of_birth)::int as day_of_month,
      to_char(sp.date_of_birth, 'MM-DD') as month_day,
      (extract(month from sp.date_of_birth)::int = extract(month from today_key)::int
        and extract(day from sp.date_of_birth)::int = extract(day from today_key)::int) as is_today
    from public.staff_profiles sp
    where sp.is_active = true
      and coalesce(sp.is_archived, false) = false
      and sp.date_of_birth is not null
      and extract(month from sp.date_of_birth)::int = month_n
      and (
        sp.branch_slug = p_branch
        or exists (
          select 1 from public.staff_branch_assignments sba
          where sba.staff_id = sp.id and sba.branch_slug = p_branch
        )
      )
  ) t;

  return jsonb_build_object(
    'ok', true,
    'month', month_n,
    'business_date', today_key,
    'people', rows
  );
end;
$$;

revoke all on function public.save_own_staff_birthday(date) from public, anon;
grant execute on function public.save_own_staff_birthday(date) to authenticated;
revoke all on function public.staff_birthdays_month(text, int) from public, anon;
grant execute on function public.staff_birthdays_month(text, int) to authenticated;
