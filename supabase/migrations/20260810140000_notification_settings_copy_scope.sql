-- Smart detailing reminders: custom copy + explicit scope (whole / branch / service / both).

begin;

alter table public.notification_settings
  add column if not exists scope text not null default 'whole',
  add column if not exists title text,
  add column if not exists message text;

alter table public.notification_settings
  drop constraint if exists notification_settings_scope_check;

alter table public.notification_settings
  add constraint notification_settings_scope_check
  check (scope in ('whole', 'per_branch', 'per_service', 'per_service_branch'));

-- Message length: BusyBee single SMS = 160; push body capped at 200.
alter table public.notification_settings
  drop constraint if exists notification_settings_message_len;

alter table public.notification_settings
  add constraint notification_settings_message_len
  check (message is null or char_length(message) <= 200);

alter table public.notification_settings
  drop constraint if exists notification_settings_title_len;

alter table public.notification_settings
  add constraint notification_settings_title_len
  check (title is null or char_length(title) <= 160);

-- Backfill scope from existing service/branch nullability.
update public.notification_settings
set scope = case
  when service_id is not null and branch_slug is not null then 'per_service_branch'
  when service_id is not null then 'per_service'
  when branch_slug is not null then 'per_branch'
  else 'whole'
end
where scope is null or scope = 'whole';

-- Unique per resolved scope key (nulls coalesce so "whole" is one row).
drop index if exists notification_settings_scope_uidx;
alter table public.notification_settings
  drop constraint if exists notification_settings_service_id_branch_slug_key;

create unique index if not exists notification_settings_scope_uidx
  on public.notification_settings (
    scope,
    coalesce(service_id::text, ''),
    coalesce(branch_slug, '')
  );

-- Broadcast body also respects BusyBee hard cap (1000); UI enforces 160 for SMS.
alter table public.notification_broadcasts
  drop constraint if exists notification_broadcasts_body_len;

alter table public.notification_broadcasts
  add constraint notification_broadcasts_body_len
  check (body is null or char_length(body) <= 1000);

alter table public.notification_broadcasts
  drop constraint if exists notification_broadcasts_title_len;

alter table public.notification_broadcasts
  add constraint notification_broadcasts_title_len
  check (char_length(title) <= 160);

commit;
