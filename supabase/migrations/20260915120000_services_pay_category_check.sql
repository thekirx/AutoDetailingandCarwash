-- Constrain services.pay_category to the catalog kinds used by Queue / Bookings / POS.
-- Bay: general | wash | addon | package | ppf (legacy same-day film packages)
-- Multi-day detailing board: detailing

alter table public.services drop constraint if exists services_pay_category_check;
alter table public.services
  add constraint services_pay_category_check
  check (pay_category = any (array[
    'general'::text,
    'wash'::text,
    'addon'::text,
    'package'::text,
    'ppf'::text,
    'detailing'::text
  ]));

comment on column public.services.pay_category is
  'Catalog family: wash/general/addon/package/ppf = same-day Queue+POS bay; detailing = Bookings board.';
