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
