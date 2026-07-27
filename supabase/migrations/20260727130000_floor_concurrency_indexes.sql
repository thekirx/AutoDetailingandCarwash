-- Floor board hot path: partial index for active queue statuses (TL / ASA / SA concurrent reads)

create index if not exists bookings_active_floor_idx
  on public.bookings (branch, status, created_at desc)
  where coalesce(is_archived, false) = false
    and status in ('waiting', 'in_progress', 'final_checking', 'redo');

create index if not exists queue_events_branch_created_desc_idx
  on public.queue_events (branch, created_at desc);

analyze public.bookings;
analyze public.queue_events;
