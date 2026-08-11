-- Fixed ops form kinds (4 templates) + seed published templates + Planner rename / archive Complaints board.

-- 1) Widen/lock kind check to the four fixed templates
alter table public.ops_forms drop constraint if exists ops_forms_kind_check;

-- Map legacy kinds onto the fixed set before re-adding the check
update public.ops_forms set kind = 'event' where kind in ('booking', 'survey');
update public.ops_forms set kind = 'complaint' where kind = 'custom' or kind is null or kind = '';

alter table public.ops_forms
  add constraint ops_forms_kind_check
  check (kind in ('complaint', 'event', 'equipment_repair', 'cash_advance'));

create index if not exists ops_forms_kind_idx on public.ops_forms (kind);

-- 2) Seed / upsert the four fixed templates (stable slugs)
do $$
declare
  t record;
  existing_id uuid;
begin
  for t in
    select * from (values
      (
        'complaint'::text,
        'customer-complaints'::text,
        'Customer Complaints'::text,
        'Tell us what went wrong so we can make it right.'::text,
        true,
        '[
          {"key":"customer_name","label":"Customer name","type":"text","required":true,"options":[]},
          {"key":"phone","label":"Phone","type":"phone","required":false,"options":[]},
          {"key":"branch","label":"Branch","type":"select","required":true,"options":["bacoor","batangas"]},
          {"key":"category","label":"Category","type":"select","required":true,"options":["Service quality","Wait time","Damage","Staff","Other"]},
          {"key":"description","label":"Description","type":"textarea","required":true,"options":[]}
        ]'::jsonb
      ),
      (
        'event',
        'events-rsvp',
        'Events RSVP',
        'Confirm your spot for the next Hakum event.',
        true,
        '[
          {"key":"name","label":"Full name","type":"text","required":true,"options":[]},
          {"key":"phone","label":"Phone","type":"phone","required":true,"options":[]},
          {"key":"email","label":"Email","type":"email","required":false,"options":[]},
          {"key":"guests","label":"Guests","type":"number","required":false,"options":[]},
          {"key":"notes","label":"Notes","type":"textarea","required":false,"options":[]}
        ]'::jsonb
      ),
      (
        'equipment_repair',
        'equipment-repairs',
        'Equipment Repairs',
        'Crew reports equipment issues for ops follow-up.',
        false,
        '[
          {"key":"reporter","label":"Reported by","type":"text","required":true,"options":[]},
          {"key":"branch","label":"Branch","type":"select","required":true,"options":["bacoor","batangas"]},
          {"key":"equipment","label":"Equipment","type":"text","required":true,"options":[]},
          {"key":"urgency","label":"Urgency","type":"select","required":true,"options":["Low","Medium","High","Critical"]},
          {"key":"description","label":"Issue description","type":"textarea","required":true,"options":[]}
        ]'::jsonb
      ),
      (
        'cash_advance',
        'cash-advance',
        'Employee Cash Advance',
        'Request a cash advance. Managers review submissions in Planner.',
        false,
        '[
          {"key":"employee_name","label":"Employee name","type":"text","required":true,"options":[]},
          {"key":"branch","label":"Branch","type":"select","required":true,"options":["bacoor","batangas"]},
          {"key":"amount","label":"Amount (₱)","type":"number","required":true,"options":[]},
          {"key":"needed_by","label":"Needed by","type":"date","required":true,"options":[]},
          {"key":"reason","label":"Reason","type":"textarea","required":true,"options":[]}
        ]'::jsonb
      )
    ) as v(kind, slug, name, description, public_enabled, fields)
  loop
    select id into existing_id from public.ops_forms where slug = t.slug limit 1;
    if existing_id is null then
      select id into existing_id from public.ops_forms where kind = t.kind order by created_at asc limit 1;
    end if;

    if existing_id is null then
      insert into public.ops_forms (
        name, kind, slug, description, fields, status, public_enabled, is_active, settings
      ) values (
        t.name,
        t.kind,
        t.slug,
        t.description,
        t.fields,
        'published',
        t.public_enabled,
        true,
        jsonb_build_object(
          'push_to_planning', true,
          'show_on_calendar', t.kind = 'event',
          'show_logo', true,
          'logo_url', '/branding/hakum-lw-ow.png',
          'header_title', ''
        )
      );
    else
      update public.ops_forms
      set
        name = coalesce(nullif(btrim(name), ''), t.name),
        kind = t.kind,
        slug = t.slug,
        description = coalesce(nullif(btrim(coalesce(description, '')), ''), t.description),
        status = 'published',
        is_active = true,
        public_enabled = t.public_enabled,
        fields = case
          when fields is null or jsonb_typeof(fields) <> 'array' or jsonb_array_length(fields) = 0
            then t.fields
          else fields
        end,
        settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
          'show_logo', coalesce((settings->>'show_logo')::boolean, true),
          'logo_url', coalesce(nullif(settings->>'logo_url', ''), '/branding/hakum-lw-ow.png')
        )
      where id = existing_id;
    end if;
  end loop;
end $$;

-- Archive extra forms that are not one of the four fixed kinds/slugs (keep history rows)
update public.ops_forms
set status = 'archived', is_active = false, public_enabled = false
where slug not in ('customer-complaints', 'events-rsvp', 'equipment-repairs', 'cash-advance')
  and kind not in ('complaint', 'event', 'equipment_repair', 'cash_advance');

-- Prefer one live form per kind: archive duplicates by kind keeping the fixed slug
update public.ops_forms f
set status = 'archived', is_active = false, public_enabled = false
where f.slug not in ('customer-complaints', 'events-rsvp', 'equipment-repairs', 'cash-advance')
  and exists (
    select 1 from public.ops_forms keep
    where keep.kind = f.kind
      and keep.slug in ('customer-complaints', 'events-rsvp', 'equipment-repairs', 'cash-advance')
  );

-- 3) Planner rename + remove redundant Complaints specialty board from active use
update public.plan_boards
set name = 'Planner'
where name in ('Hakum Planner', 'Hakum Planning');

-- Soft-retire Complaints board (tasks stay; UI hides archived-name boards)
update public.plan_boards
set name = 'Complaints (archived)'
where name = 'Complaints';
