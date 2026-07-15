begin;

-- Cover the foreign keys introduced by 20260715153235 so parent-row updates,
-- deletes, and branch/audit filtering do not require full child-table scans.
create index if not exists idx_branches_created_by
  on public.branches (created_by);

create index if not exists idx_branches_updated_by
  on public.branches (updated_by);

create index if not exists idx_queue_assignments_cancelled_by
  on public.queue_assignments (cancelled_by);

create index if not exists idx_vehicles_first_branch
  on public.vehicles (first_branch);

create index if not exists idx_vehicles_last_branch
  on public.vehicles (last_branch);

commit;
