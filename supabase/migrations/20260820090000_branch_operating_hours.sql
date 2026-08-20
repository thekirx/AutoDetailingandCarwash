-- Branch operating hours.
--
-- The public homepage shows live queue counts. Without hours it has no way to
-- tell an empty queue from a closed shop, so at 3 AM it was reporting an open
-- bay. These columns let the public widget say "Closed · Opens 8:00 AM"
-- instead, and suppress queue wording outside business hours.
--
-- Times are local wall-clock for a single-country business (Asia/Manila) and
-- are deliberately `time` rather than `timestamptz`: they describe a recurring
-- daily schedule, not an instant.
--
-- All three columns are nullable / empty by default. Unknown hours keep the
-- previous behaviour (queue counts only, no availability claim), so this
-- migration is safe to apply before any branch is filled in.

alter table public.branches
  add column if not exists opens_at time,
  add column if not exists closes_at time,
  add column if not exists closed_weekdays smallint[] not null default '{}';

comment on column public.branches.opens_at is
  'Local opening time (Asia/Manila). NULL = hours unknown, public site shows no availability claim.';
comment on column public.branches.closes_at is
  'Local closing time (Asia/Manila). A value earlier than opens_at means the branch closes after midnight.';
comment on column public.branches.closed_weekdays is
  'Weekdays the branch is shut, ISO numbering: 1 = Monday … 7 = Sunday. Empty = open every day.';

-- ISO weekday numbers only, so the client can index by date.getDay() safely.
alter table public.branches
  drop constraint if exists branches_closed_weekdays_range;

alter table public.branches
  add constraint branches_closed_weekdays_range
  check (closed_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]);

-- Hours are public information; the existing anon select policy on branches
-- already covers these columns, so no policy change is needed here.

-- ---------------------------------------------------------------------------
-- Seed the current schedule: 8:00 AM – 8:00 PM, open every day.
--
-- Guarded on `opens_at is null` so re-running this migration never clobbers
-- hours an admin has since changed through the app.
-- ---------------------------------------------------------------------------
update public.branches
set opens_at = '08:00',
    closes_at = '20:00',
    closed_weekdays = '{}'
where opens_at is null
  and closes_at is null
  and not is_archived;

-- ---------------------------------------------------------------------------
-- Editing hours from the admin app.
--
-- A separate RPC rather than more parameters on update_branch: that function
-- has four historical signatures across migrations and several callers, and
-- widening it again risks breaking one of them. The access rule is copied
-- from the current update_branch so the two cannot drift into disagreeing
-- about who may edit a branch.
-- ---------------------------------------------------------------------------
create or replace function public.set_branch_hours(
  input_branch_slug text,
  input_opens_at time,
  input_closes_at time,
  input_closed_weekdays smallint[] default '{}'
)
returns public.branches
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  caller_id uuid := (select auth.uid());
  target_slug text := lower(trim(input_branch_slug));
  updated_branch public.branches%rowtype;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Sign in required';
  end if;
  if not (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('branches'))
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(target_slug)
    )
  ) then
    raise exception using errcode = '42501', message = 'Not allowed to update this branch';
  end if;

  -- Both or neither: half a schedule cannot be evaluated, and the public site
  -- reads a partial row as "hours unknown" anyway.
  if (input_opens_at is null) <> (input_closes_at is null) then
    raise exception using errcode = '23514', message = 'Set both opening and closing time, or clear both';
  end if;
  if input_opens_at is not null and input_opens_at = input_closes_at then
    raise exception using errcode = '23514', message = 'Opening and closing time must differ';
  end if;

  update public.branches br
  set opens_at = input_opens_at,
      closes_at = input_closes_at,
      closed_weekdays = coalesce(input_closed_weekdays, '{}'),
      updated_by = caller_id,
      updated_at = clock_timestamp()
  where br.slug = target_slug
    and not br.is_archived
  returning * into updated_branch;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active branch not found';
  end if;
  return updated_branch;
end;
$$;

revoke all on function public.set_branch_hours(text, time, time, smallint[]) from public, anon;
grant execute on function public.set_branch_hours(text, time, time, smallint[]) to authenticated;
