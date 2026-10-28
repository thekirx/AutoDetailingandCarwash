-- Inquiry on Facebook page is a detailing booking source. Old rows stay valid.
alter table public.bookings drop constraint if exists bookings_referral_source_check;
alter table public.bookings
  add constraint bookings_referral_source_check
  check (
    referral_source is null
    or referral_source in (
      'talked_to_employee',
      'facebook_ads',
      'social_media',
      'friend_referral',
      'facebook_page'
    )
  );

-- Starting friend discount is 5% when nobody has saved another number.
-- A saved rate other than the old 3% default is left alone.

update public.app_settings
   set value = jsonb_set(value, '{discount_rate}', '0.05'::jsonb, true),
       updated_at = now()
 where key = 'referral_program'
   and coalesce(nullif(value->>'discount_rate', '')::numeric, 0.03) = 0.03;

create or replace function public.referral_program_settings()
returns table (friend_points int, discount_rate numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    least(100000, greatest(0, coalesce((
      select nullif(value->>'friend_points', '')::int
      from public.app_settings
      where key = 'referral_program'
    ), 50))),
    least(1::numeric, greatest(0::numeric, coalesce((
      select nullif(value->>'discount_rate', '')::numeric
      from public.app_settings
      where key = 'referral_program'
    ), 0.05)))
$$;
