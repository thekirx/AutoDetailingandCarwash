-- O-06: branch_operating_hours (prior live migration name existed without a table).
-- day_of_week: 0=Sunday … 6=Saturday (matches JS Date.getDay / Asia/Manila open-now).

create table if not exists public.branch_operating_hours (
  id bigint generated always as identity primary key,
  branch_slug text not null references public.branches (slug) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint branch_operating_hours_slug_day_uidx unique (branch_slug, day_of_week),
  constraint branch_operating_hours_open_window_check check (
    is_closed
    or (
      opens_at is not null
      and closes_at is not null
      and closes_at > opens_at
    )
  )
);

create index if not exists branch_operating_hours_slug_idx
  on public.branch_operating_hours (branch_slug);

comment on table public.branch_operating_hours is
  'Weekly open hours per branch. Public-readable for /branches; writers match update_branch auth.';

alter table public.branch_operating_hours enable row level security;

drop policy if exists "Anyone can read branch hours" on public.branch_operating_hours;
create policy "Anyone can read branch hours"
  on public.branch_operating_hours for select
  to anon, authenticated
  using (true);

drop policy if exists "Branch managers can insert hours" on public.branch_operating_hours;
create policy "Branch managers can insert hours"
  on public.branch_operating_hours for insert
  to authenticated
  with check (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('branches'))
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  );

drop policy if exists "Branch managers can update hours" on public.branch_operating_hours;
create policy "Branch managers can update hours"
  on public.branch_operating_hours for update
  to authenticated
  using (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('branches'))
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  )
  with check (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('branches'))
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  );

drop policy if exists "Branch managers can delete hours" on public.branch_operating_hours;
create policy "Branch managers can delete hours"
  on public.branch_operating_hours for delete
  to authenticated
  using (
    public.is_super_admin()
    or (public.is_assistant_super_admin() and public.asa_has_grant('branches'))
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  );

revoke all on public.branch_operating_hours from anon, authenticated;
grant select on public.branch_operating_hours to anon, authenticated;
grant select, insert, update, delete on public.branch_operating_hours to authenticated;

-- Default: daily 08:00–18:00 Asia/Manila for every non-archived branch missing a week.
insert into public.branch_operating_hours (branch_slug, day_of_week, opens_at, closes_at, is_closed)
select b.slug, d.day_of_week, time '08:00', time '18:00', false
from public.branches b
cross join generate_series(0, 6) as d(day_of_week)
where not coalesce(b.is_archived, false)
  and not exists (
    select 1 from public.branch_operating_hours h where h.branch_slug = b.slug
  );
