-- TL cancel-with-reason (no hard delete). Keep null for legacy rows.
alter table public.bookings
  add column if not exists cancellation_reason text;

comment on column public.bookings.cancellation_reason is
  'Required when status=cancelled from ops UI (3-500 chars). Soft cancel only.';

-- Form booking boards: branch + status + schedule lookups.
create index if not exists bookings_branch_status_scheduled_idx
  on public.bookings (branch, status, scheduled_start desc)
  where coalesce(is_archived, false) = false;
