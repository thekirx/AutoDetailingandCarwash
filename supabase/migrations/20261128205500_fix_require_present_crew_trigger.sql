-- Fix live DB trigger require_present_crew_on_start() which was broken by enum cast
-- (coalesce(old.status, '')) and stale table references (employees / employee_attendance).
-- Restore clean check using visit_has_present_crew() -> queue_assignments + staff_attendance,
-- and enforce crew requirement across both queue services and packages.
create or replace function public.require_present_crew_on_start()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if current_user <> 'authenticated'
     or new.status::text <> 'in_progress'
     or coalesce(old.status::text, '') = 'in_progress' then
    return new;
  end if;

  if lower(coalesce((select s.pay_category from public.services s where s.id = new.service_id), '')) in ('ppf', 'detailing') then
    return new;
  end if;

  if not public.visit_has_present_crew(new.id, new.visit_group_id) then
    raise exception using
      errcode = '23514',
      message = 'Assign at least one present crew member before starting service.';
  end if;

  return new;
end;
$$;

revoke all on function public.require_present_crew_on_start() from public, anon, authenticated;

drop trigger if exists trg_require_present_crew_on_start on public.bookings;
create trigger trg_require_present_crew_on_start
  before update of status on public.bookings
  for each row
  execute function public.require_present_crew_on_start();
