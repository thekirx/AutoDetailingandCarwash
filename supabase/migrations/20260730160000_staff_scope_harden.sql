-- Staff scope: vehicles/transactions harden; assignment column lock; active-only booking read
begin;

-- STF-C1: vehicles — staff cannot manage company-wide; TL stays branch-scoped; admin branch-scoped
-- Helper first (used by read policy)
create or replace function public.staff_is_assigned_to_booking_vehicle(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select exists (
    select 1
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where qa.staff_id = (select auth.uid())
      and qa.status in ('pending', 'active')
      and b.vehicle_id = p_vehicle_id
  );
$$;

revoke all on function public.staff_is_assigned_to_booking_vehicle(uuid) from public, anon;
grant execute on function public.staff_is_assigned_to_booking_vehicle(uuid) to authenticated;

drop policy if exists "Allow operations manage vehicles" on public.vehicles;
create policy "Allow operations manage vehicles"
on public.vehicles
for all
to authenticated
using (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or (
    public.current_user_role() = 'admin'
    and (
      last_branch is null
      or public.user_has_branch_access(last_branch)
    )
  )
  or (
    public.is_team_lead()
    and (last_branch is null or last_branch = public.current_user_branch())
  )
)
with check (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or (
    public.current_user_role() = 'admin'
    and (
      last_branch is null
      or public.user_has_branch_access(last_branch)
    )
  )
  or (
    public.is_team_lead()
    and (last_branch is null or last_branch = public.current_user_branch())
  )
);

drop policy if exists "Allow operations read vehicles" on public.vehicles;
create policy "Allow operations read vehicles"
on public.vehicles
for select
to authenticated
using (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or public.current_user_role() in ('admin', 'team_lead', 'cashier')
  or (
    public.current_user_role() = 'staff'
    and public.staff_is_assigned_to_booking_vehicle(id)
  )
);

-- STF-H5: booking read only while assignment is live
create or replace function public.staff_is_assigned_to_booking(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select exists (
    select 1
    from public.queue_assignments qa
    where qa.booking_id = p_booking_id
      and qa.staff_id = (select auth.uid())
      and qa.status in ('pending', 'active')
  );
$$;

-- STF-C2: transactions — drop is_staff() money access
drop policy if exists "Staff can select transactions" on public.transactions;
drop policy if exists "Staff can insert transactions" on public.transactions;
drop policy if exists "Staff can update transactions" on public.transactions;

-- STF-C3: replace open own-row update with status-only RPCs
drop policy if exists "Staff can update own queue assignments" on public.queue_assignments;

create or replace function public.acknowledge_queue_assignment(p_assignment_id uuid)
returns public.queue_assignments
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  row public.queue_assignments%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  update public.queue_assignments qa
  set status = 'active',
      started_at = coalesce(qa.started_at, clock_timestamp())
  where qa.id = p_assignment_id
    and qa.staff_id = auth.uid()
    and qa.status = 'pending'
  returning * into row;

  if not found then
    raise exception using errcode = 'P0002', message = 'Assignment not found or not acknowledgeable';
  end if;
  return row;
end;
$$;

create or replace function public.complete_queue_assignment(p_assignment_id uuid)
returns public.queue_assignments
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  row public.queue_assignments%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  update public.queue_assignments qa
  set status = 'released',
      released_at = clock_timestamp(),
      completed_at = coalesce(qa.completed_at, clock_timestamp())
  where qa.id = p_assignment_id
    and qa.staff_id = auth.uid()
    and qa.status = 'active'
  returning * into row;

  if not found then
    raise exception using errcode = 'P0002', message = 'Assignment not found or not completable';
  end if;
  return row;
end;
$$;

revoke all on function public.acknowledge_queue_assignment(uuid) from public, anon;
revoke all on function public.complete_queue_assignment(uuid) from public, anon;
grant execute on function public.acknowledge_queue_assignment(uuid) to authenticated;
grant execute on function public.complete_queue_assignment(uuid) to authenticated;

-- STF-H4: plan assignees — lock card_id/staff_id
create or replace function public.guard_plan_card_assignee_self_update()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if tg_op = 'UPDATE'
     and old.staff_id = auth.uid()
     and not public.is_super_admin()
  then
    if new.card_id is distinct from old.card_id then
      raise exception using errcode = '42501', message = 'Cannot reassign planning card';
    end if;
    if new.staff_id is distinct from old.staff_id then
      raise exception using errcode = '42501', message = 'Cannot transfer planning assignment';
    end if;
    if new.status is distinct from old.status
       and not (
         (old.status = 'todo' and new.status = 'in_progress')
         or (old.status = 'in_progress' and new.status = 'done')
       )
    then
      raise exception using errcode = '42501', message = 'Illegal planning status transition';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_plan_card_assignee_self_update on public.plan_card_assignees;
create trigger trg_guard_plan_card_assignee_self_update
before update on public.plan_card_assignees
for each row execute function public.guard_plan_card_assignee_self_update();

commit;
