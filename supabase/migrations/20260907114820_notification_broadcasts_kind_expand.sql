-- Allow CRM retention broadcast kinds on notification_broadcasts.kind

begin;

alter table public.notification_broadcasts drop constraint if exists notification_broadcasts_kind_check;
alter table public.notification_broadcasts add constraint notification_broadcasts_kind_check
  check (kind = any (array[
    'promo'::text,
    'reminder'::text,
    'we_missed'::text,
    'aftercare'::text,
    'package_nudge'::text,
    'loyalty_nudge'::text,
    'thank_you'::text,
    'custom'::text
  ]));

commit;
