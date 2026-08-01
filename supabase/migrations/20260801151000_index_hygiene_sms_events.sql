-- Index hygiene for scale: drop near-duplicates; add sms_events time index.

-- Floor composite already covers (branch, status, created_at); keep partial active-floor index.
drop index if exists public.bookings_status_branch_created_idx;

-- Ascending queue_events index overlaps desc hot-path index from floor concurrency migration.
drop index if exists public.idx_queue_events_branch_created_at;

-- Leading column covered by expenses_branch_created_at_idx.
drop index if exists public.expenses_created_at_idx;

-- SMS ops list / purge by time
create index if not exists sms_events_created_at_idx
  on public.sms_events (created_at desc);
