-- Referral answers: employee, Facebook ads, social media, or a customer's friend code.
update public.bookings
  set referral_source = 'talked_to_employee'
  where referral_source = 'hakum_staff';

update public.bookings
  set referral_source = null
  where referral_source is not null
    and referral_source not in ('talked_to_employee', 'facebook_ads', 'social_media', 'friend_referral');

alter table public.bookings drop constraint if exists bookings_referral_source_check;

alter table public.bookings
  add constraint bookings_referral_source_check
  check (
    referral_source is null
    or referral_source in ('talked_to_employee', 'facebook_ads', 'social_media', 'friend_referral')
  );
