-- Future-proof branch references: drop hardcoded booking branch enum, FK to branches.slug

alter table public.bookings
  drop constraint if exists bookings_branch_check;

alter table public.bookings
  drop constraint if exists bookings_branch_fkey;

-- ponytail: add FK only when no orphan branch values exist
do $$
begin
  if not exists (
    select 1
    from public.bookings b
    left join public.branches br on br.slug = b.branch
    where b.branch is not null and br.slug is null
  ) then
    alter table public.bookings
      add constraint bookings_branch_fkey
      foreign key (branch) references public.branches (slug);
  end if;
end;
$$;

create index if not exists bookings_branch_idx
  on public.bookings (branch)
  where is_archived = false;
