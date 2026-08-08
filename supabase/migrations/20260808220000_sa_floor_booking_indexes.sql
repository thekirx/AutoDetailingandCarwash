-- SA floor period queries filter bookings by completed_at / cancelled_at / redo_at / in_progress_at.
-- Partial indexes keep live floor scans lean (security: only non-archived rows).

create index if not exists bookings_completed_at_branch_idx
  on public.bookings (branch, completed_at desc)
  where status = 'completed' and coalesce(is_archived, false) = false;

create index if not exists bookings_cancelled_at_branch_idx
  on public.bookings (branch, cancelled_at desc)
  where status = 'cancelled' and coalesce(is_archived, false) = false;

create index if not exists bookings_redo_at_branch_idx
  on public.bookings (branch, redo_at desc)
  where redo_at is not null and coalesce(is_archived, false) = false;

create index if not exists bookings_in_progress_at_branch_idx
  on public.bookings (branch, in_progress_at desc)
  where in_progress_at is not null and coalesce(is_archived, false) = false;
