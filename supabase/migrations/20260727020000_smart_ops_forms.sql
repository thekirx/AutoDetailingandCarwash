-- Smart form builder: shareable public fill, statuses, event attach, calendar dates
-- Indexes for list/filter paths; RPCs for anon fill (no open table grants).

-- Expand kind + lifecycle columns on ops_forms
alter table public.ops_forms drop constraint if exists ops_forms_kind_check;
alter table public.ops_forms
  add constraint ops_forms_kind_check
  check (kind in ('complaint', 'event', 'booking', 'survey', 'custom'));

alter table public.ops_forms
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists status text not null default 'draft',
  add column if not exists public_enabled boolean not null default false,
  add column if not exists event_id uuid references public.events (id) on delete set null,
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.ops_forms drop constraint if exists ops_forms_status_check;
alter table public.ops_forms
  add constraint ops_forms_status_check
  check (status in ('draft', 'published', 'archived'));

alter table public.ops_forms drop constraint if exists ops_forms_settings_object;
alter table public.ops_forms
  add constraint ops_forms_settings_object check (jsonb_typeof(settings) = 'object');

-- Backfill slugs for existing forms
update public.ops_forms
set slug = lower(regexp_replace(coalesce(name, 'form'), '[^a-zA-Z0-9]+', '-', 'g'))
           || '-' || substr(replace(id::text, '-', ''), 1, 8)
where slug is null or btrim(slug) = '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ops_forms_slug_unique') then
    alter table public.ops_forms add constraint ops_forms_slug_unique unique (slug);
  end if;
end $$;

create index if not exists ops_forms_status_active_idx
  on public.ops_forms (status, is_active)
  where is_active = true;

create index if not exists ops_forms_event_id_idx
  on public.ops_forms (event_id)
  where event_id is not null;

create index if not exists ops_forms_public_slug_idx
  on public.ops_forms (slug)
  where public_enabled = true and status = 'published' and is_active = true;

-- Optional form attach on events (customers / link respondents)
alter table public.events
  add column if not exists form_id uuid references public.ops_forms (id) on delete set null;

create index if not exists events_form_id_idx
  on public.events (form_id)
  where form_id is not null;

-- Submissions: workflow status + calendar date
alter table public.ops_form_submissions
  add column if not exists status text not null default 'new',
  add column if not exists calendar_at timestamptz,
  add column if not exists respondent_label text,
  add column if not exists source text not null default 'staff';

alter table public.ops_form_submissions drop constraint if exists ops_form_submissions_status_check;
alter table public.ops_form_submissions
  add constraint ops_form_submissions_status_check
  check (status in ('new', 'in_review', 'resolved', 'archived'));

alter table public.ops_form_submissions drop constraint if exists ops_form_submissions_source_check;
alter table public.ops_form_submissions
  add constraint ops_form_submissions_source_check
  check (source in ('staff', 'public'));

create index if not exists ops_form_submissions_status_idx
  on public.ops_form_submissions (form_id, status, created_at desc);

create index if not exists ops_form_submissions_calendar_idx
  on public.ops_form_submissions (calendar_at)
  where calendar_at is not null;

-- Publish existing complaint form so share flow works after deploy
update public.ops_forms
set status = 'published',
    public_enabled = true,
    kind = case when kind = 'complaint' then 'complaint' else kind end
where kind = 'complaint' and status = 'draft';

-- Public read of published form definition (no auth)
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

-- Public submit (validates required keys lightly; calendar_at optional)
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
    -- first date/datetime field in payload
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

  -- Also honor due_at alias in payload
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
