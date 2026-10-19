-- Where a detailing booking heard about Hakum, and which crew member was named.
alter table public.bookings
  add column if not exists referral_source text,
  add column if not exists referred_by_name text,
  add column if not exists referred_by_staff_id uuid references public.staff_profiles(id) on delete set null;

alter table public.bookings
  drop constraint if exists bookings_referral_source_check;

alter table public.bookings
  add constraint bookings_referral_source_check
  check (
    referral_source is null
    or referral_source in ('social_media', 'google', 'friend', 'drove_by', 'hakum_staff', 'other')
  );

create index if not exists bookings_referral_source_idx
  on public.bookings (referral_source)
  where referral_source is not null;
