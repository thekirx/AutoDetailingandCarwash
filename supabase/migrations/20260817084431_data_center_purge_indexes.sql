-- Data Center standard purge: archived-row filters and age-based log deletes.
-- Matches WHERE coalesce(is_archived, false) = true and created_at < cutoff.

create index if not exists bookings_archived_created_idx
  on public.bookings (created_at)
  where coalesce(is_archived, false) = true;

create index if not exists customers_archived_created_idx
  on public.customers (created_at)
  where coalesce(is_archived, false) = true;

create index if not exists vehicles_archived_created_idx
  on public.vehicles (created_at)
  where coalesce(is_archived, false) = true;

create index if not exists user_notifications_created_at_idx
  on public.user_notifications (created_at);

create index if not exists contact_inquiries_created_at_idx
  on public.contact_inquiries (created_at);
