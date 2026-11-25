-- Super Admin–controlled deterministic chatbot widget config in app_settings
-- + anonymous/customer safe read RPC (does not expose private app_settings rows).

begin;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_super_admin'
  ) then raise exception 'public.is_super_admin() is missing — apply helper migration first';
  end if;
end $$;

insert into public.app_settings (key, value, updated_at)
values (
  'chatbot_widget',
  jsonb_build_object(
    'enabled', true,
    'launcher_label', 'Ask Hakum Concierge',
    'welcome_title', 'Hakum Auto Care Concierge',
    'welcome_message', 'Instant answers on car wash, detailing, ClearPro PPF, Ceramic Coating, Nano Ceramic Tint, branches, booking, live queue, and your loyalty rewards.',
    'accent_preset', 'sapphire',
    'human_handoff_enabled', true,
    'human_cta_label', 'Chat on Messenger',
    'facebook_url', 'https://www.facebook.com/profile.php?id=61573318005308',
    'messenger_url', 'https://m.me/61573318005308',
    'promo_enabled', true,
    'promo_eyebrow', 'Studio Spotlight',
    'promo_title', 'ClearPro PPF + Free Glass & Wheels Coating',
    'promo_description', 'Self-healing TPU paint protection from ₱48,000, or Unlimited Recoating Ceramic packages built for Philippine roads.',
    'promo_cta_label', 'Explore ClearPro PPF',
    'promo_cta_path', '/services/ppf',
    'suggested_prompts', jsonb_build_array(
      'ClearPro PPF prices & warranty',
      'Compare Ceramic Coating tiers',
      'Check live Bacoor queue',
      'Tint VLT & heat rejection',
      'Talk to a real person',
      'My loyalty stamps & rewards',
      'Shop merch, care gear & coffee',
      'How to book or reschedule'
    )
  ),
  now()
)
on conflict (key) do nothing;

-- Restrict chatbot_widget writes to Super Admin (BossMich), preserving attendance_roles lock.
drop policy if exists app_settings_staff_insert on public.app_settings;
drop policy if exists app_settings_staff_update on public.app_settings;
drop policy if exists app_settings_staff_delete on public.app_settings;

create policy app_settings_staff_insert
  on public.app_settings
  for insert
  to authenticated
  with check (
    (key not in ('attendance_roles', 'chatbot_widget') and public.is_admin())
    or (key = 'attendance_roles' and public.is_super_admin())
    or (key = 'chatbot_widget' and public.is_super_admin())
  );

create policy app_settings_staff_update
  on public.app_settings
  for update
  to authenticated
  using (
    (key not in ('attendance_roles', 'chatbot_widget') and public.is_admin())
    or (key = 'attendance_roles' and public.is_super_admin())
    or (key = 'chatbot_widget' and public.is_super_admin())
  )
  with check (
    (key not in ('attendance_roles', 'chatbot_widget') and public.is_admin())
    or (key = 'attendance_roles' and public.is_super_admin())
    or (key = 'chatbot_widget' and public.is_super_admin())
  );

create policy app_settings_staff_delete
  on public.app_settings
  for delete
  to authenticated
  using (
    (key not in ('attendance_roles', 'chatbot_widget') and public.is_admin())
    or (key = 'attendance_roles' and public.is_super_admin())
    or (key = 'chatbot_widget' and public.is_super_admin())
  );

create or replace function public.get_public_chatbot_settings()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with defaults as (
    select jsonb_build_object(
      'enabled', true,
      'launcher_label', 'Ask Hakum Concierge',
      'welcome_title', 'Hakum Auto Care Concierge',
      'welcome_message', 'Instant answers on car wash, detailing, ClearPro PPF, Ceramic Coating, Nano Ceramic Tint, branches, booking, live queue, and your loyalty rewards.',
      'accent_preset', 'sapphire',
      'human_handoff_enabled', true,
      'human_cta_label', 'Chat on Messenger',
      'facebook_url', 'https://www.facebook.com/profile.php?id=61573318005308',
      'messenger_url', 'https://m.me/61573318005308',
      'promo_enabled', true,
      'promo_eyebrow', 'Studio Spotlight',
      'promo_title', 'ClearPro PPF + Free Glass & Wheels Coating',
      'promo_description', 'Self-healing TPU paint protection from ₱48,000, or Unlimited Recoating Ceramic packages built for Philippine roads.',
      'promo_cta_label', 'Explore ClearPro PPF',
      'promo_cta_path', '/services/ppf',
      'suggested_prompts', jsonb_build_array(
        'ClearPro PPF prices & warranty',
        'Compare Ceramic Coating tiers',
        'Check live Bacoor queue',
        'Tint VLT & heat rejection',
        'Talk to a real person',
        'My loyalty stamps & rewards',
        'Shop merch, care gear & coffee',
        'How to book or reschedule'
      )
    ) as val
  )
  select coalesce(
    (
      select defaults.val || jsonb_strip_nulls(value)
      from public.app_settings, defaults
      where key = 'chatbot_widget'
    ),
    (select val from defaults)
  );
$$;

revoke all on function public.get_public_chatbot_settings() from public, anon, authenticated;
grant execute on function public.get_public_chatbot_settings() to anon, authenticated;

analyze public.app_settings;

commit;
