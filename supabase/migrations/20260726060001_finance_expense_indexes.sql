-- Part 5 follow-up: indexes for Finance expense filters
-- query: branch + created_at + category_id

create index if not exists expenses_branch_created_at_idx
  on public.expenses (branch, created_at desc);

create index if not exists expenses_created_at_idx
  on public.expenses (created_at desc);

create index if not exists expenses_category_id_idx
  on public.expenses (category_id);
