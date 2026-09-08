-- Detailing public forms (CRUD) + permanent /f/:slug share QR targets.

begin;

alter table public.ops_forms drop constraint if exists ops_forms_kind_check;
alter table public.ops_forms
  add constraint ops_forms_kind_check
  check (kind in (
    'complaint',
    'event',
    'equipment_repair',
    'cash_advance',
    'detailing'
  ));

-- Seed one default public detailing inquiry form (idempotent by slug).
insert into public.ops_forms (
  name,
  kind,
  slug,
  description,
  fields,
  settings,
  public_enabled,
  status,
  is_active
)
select
  'Detailing inquiry',
  'detailing',
  'detailing-inquiry',
  'Request ceramic, tint, PPF, or paint maintenance. Our team will confirm your branch and schedule.',
  jsonb_build_array(
    jsonb_build_object('key', 'customer_name', 'label', 'Full name', 'type', 'text', 'required', true, 'options', '[]'::jsonb),
    jsonb_build_object('key', 'phone', 'label', 'Mobile number', 'type', 'phone', 'required', true, 'options', '[]'::jsonb),
    jsonb_build_object('key', 'email', 'label', 'Email', 'type', 'email', 'required', false, 'options', '[]'::jsonb),
    jsonb_build_object('key', 'plate', 'label', 'Plate / conduction', 'type', 'text', 'required', true, 'options', '[]'::jsonb),
    jsonb_build_object(
      'key', 'service',
      'label', 'Detailing service',
      'type', 'select',
      'required', true,
      'options', jsonb_build_array('Ceramic Coating', 'Nano Ceramic Tint', 'Paint Protection Film (PPF)', 'Paint Maintenance', 'Other detailing')
    ),
    jsonb_build_object('key', 'branch', 'label', 'Preferred branch', 'type', 'select', 'required', true, 'options', '[]'::jsonb),
    jsonb_build_object('key', 'preferred_date', 'label', 'Preferred date', 'type', 'date', 'required', false, 'options', '[]'::jsonb),
    jsonb_build_object('key', 'notes', 'label', 'Notes', 'type', 'textarea', 'required', false, 'options', '[]'::jsonb)
  ),
  jsonb_build_object(
    'push_to_planning', true,
    'show_on_calendar', true,
    'show_logo', true,
    'logo_url', '/branding/hakum-lw-ow.png',
    'header_title', '',
    'slug_locked', true
  ),
  true,
  'published',
  true
where not exists (
  select 1 from public.ops_forms where slug = 'detailing-inquiry'
);

commit;
