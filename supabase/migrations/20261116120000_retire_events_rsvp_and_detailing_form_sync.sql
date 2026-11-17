-- Retire Events RSVP forms + add ops_form_submissions.booking_id link for Detailing Services sync.

begin;

-- 1. Detach & archive retired Events RSVP ops_forms (keep historical audit rows intact).
update public.events e
set form_id = null
from public.ops_forms f
where e.form_id = f.id
  and f.kind = 'event';

update public.ops_forms
set public_enabled = false,
    is_active = false,
    status = 'archived',
    updated_at = now()
where kind = 'event'
  and (public_enabled = true or is_active = true or status <> 'archived');

-- 2. Refuse public load/submit for retired 'event' ops_forms.
create or replace function public.get_public_ops_form(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  r public.ops_forms%rowtype;
begin
  if p_slug is null or btrim(p_slug) = '' then
    return null;
  end if;

  select * into r
  from public.ops_forms
  where slug = lower(btrim(p_slug))
    and public_enabled = true
    and is_active = true
    and status = 'published'
    and kind <> 'event'
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'kind', r.kind,
    'description', r.description,
    'fields', coalesce(r.fields, '[]'::jsonb),
    'settings', coalesce(r.settings, '{}'::jsonb),
    'event_id', r.event_id,
    'slug', r.slug
  );
end;
$$;

revoke all on function public.get_public_ops_form(text) from public;
grant execute on function public.get_public_ops_form(text) to anon, authenticated;

create or replace function public.submit_public_ops_form(
  p_slug text,
  p_payload jsonb,
  p_calendar_at timestamptz default null,
  p_respondent_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r public.ops_forms%rowtype;
  field jsonb;
  key text;
  required boolean;
  val text;
  cal timestamptz;
  new_id uuid;
  label text;
begin
  if p_slug is null or btrim(p_slug) = '' then
    raise exception 'Form slug required';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload must be an object';
  end if;

  select * into r
  from public.ops_forms
  where slug = lower(btrim(p_slug))
    and public_enabled = true
    and is_active = true
    and status = 'published'
  limit 1;

  if not found then
    raise exception 'Form not found or not open for responses';
  end if;

  if r.kind = 'event' then
    raise exception 'Events RSVP has been retired';
  end if;

  for field in select * from jsonb_array_elements(coalesce(r.fields, '[]'::jsonb))
  loop
    key := field->>'key';
    required := coalesce((field->>'required')::boolean, false);
    if required then
      val := coalesce(p_payload ->> key, '');
      if btrim(val) = '' then
        raise exception 'Missing required field: %', coalesce(field->>'label', key);
      end if;
    end if;
  end loop;

  cal := p_calendar_at;
  if cal is null then
    for field in select * from jsonb_array_elements(coalesce(r.fields, '[]'::jsonb))
    loop
      if (field->>'type') in ('date', 'datetime') then
        key := field->>'key';
        if coalesce(p_payload ->> key, '') <> '' then
          begin
            cal := (p_payload ->> key)::timestamptz;
          exception when others then
            begin
              cal := ((p_payload ->> key)::date)::timestamptz;
            exception when others then
              cal := null;
            end;
          end;
          exit when cal is not null;
        end if;
      end if;
    end loop;
  end if;

  if cal is null and coalesce(p_payload ->> 'due_at', '') <> '' then
    begin
      cal := (p_payload ->> 'due_at')::timestamptz;
    exception when others then
      cal := null;
    end;
  end if;

  label := nullif(btrim(coalesce(p_respondent_label, '')), '');
  if label is null then
    label := nullif(btrim(coalesce(
      p_payload ->> 'customer_name',
      p_payload ->> 'name',
      p_payload ->> 'full_name',
      ''
    )), '');
  end if;

  insert into public.ops_form_submissions (
    form_id, payload, due_at, calendar_at, respondent_label, source, status, created_by
  ) values (
    r.id,
    p_payload,
    cal,
    cal,
    label,
    'public',
    'new',
    null
  )
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'calendar_at', cal, 'form_id', r.id);
end;
$$;

revoke all on function public.submit_public_ops_form(text, jsonb, timestamptz, text) from public;
grant execute on function public.submit_public_ops_form(text, jsonb, timestamptz, text) to anon, authenticated;

-- 3. Add nullable booking_id FK + partial index on ops_form_submissions for Detailing Services sync.
alter table public.ops_form_submissions
  add column if not exists booking_id uuid references public.bookings (id) on delete set null;

create index if not exists ops_form_submissions_booking_id_idx
  on public.ops_form_submissions (booking_id)
  where booking_id is not null;

-- Backfill any existing payload->>'booking_id' values that match a real booking row.
update public.ops_form_submissions s
set booking_id = b.id
from public.bookings b
where s.booking_id is null
  and (s.payload ->> 'booking_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and b.id = (s.payload ->> 'booking_id')::uuid;

commit;
