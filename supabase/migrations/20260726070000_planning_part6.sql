-- Part 6: planning label/checklist catalogs, ops forms, event share slugs
-- Align planning writes with app canEditPlanning (BossMich + ASA planning_edit)

create or replace function public.can_edit_planning()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    public.is_super_admin()
    or (
      public.current_user_role() = 'assistant_super_admin'
      and coalesce(
        (
          select (sp.permission_grants ->> 'planning_edit')::boolean
          from public.staff_profiles sp
          where sp.id = auth.uid()
        ),
        false
      )
    );
$$;

revoke all on function public.can_edit_planning() from public, anon;
grant execute on function public.can_edit_planning() to authenticated;

-- Widen existing planning write policies (keep select as is_admin / assignee policies)
drop policy if exists plan_boards_write on public.plan_boards;
create policy plan_boards_write on public.plan_boards for all to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());

drop policy if exists plan_lists_write on public.plan_lists;
create policy plan_lists_write on public.plan_lists for all to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());

drop policy if exists plan_cards_write on public.plan_cards;
create policy plan_cards_write on public.plan_cards for all to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());

drop policy if exists plan_checklist_write on public.plan_checklist_items;
create policy plan_checklist_write on public.plan_checklist_items for all to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());

-- Label presets catalog
create table if not exists public.plan_label_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#94a3b8',
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint plan_label_presets_name_unique unique (name)
);

create index if not exists plan_label_presets_pos_idx on public.plan_label_presets (position);

-- Checklist templates
create table if not exists public.plan_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.plan_checklist_templates (id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plan_checklist_tmpl_items_idx
  on public.plan_checklist_template_items (template_id, position);

-- Ops forms (complaint seed + custom)
create table if not exists public.ops_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'custom'
    check (kind in ('complaint', 'custom')),
  fields jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_forms_fields_is_array check (jsonb_typeof(fields) = 'array')
);

create table if not exists public.ops_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.ops_forms (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  plan_card_id uuid references public.plan_cards (id) on delete set null,
  due_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ops_form_submissions_payload_object check (jsonb_typeof(payload) = 'object')
);

create index if not exists ops_form_submissions_form_idx on public.ops_form_submissions (form_id, created_at desc);
create index if not exists ops_form_submissions_card_idx on public.ops_form_submissions (plan_card_id)
  where plan_card_id is not null;

-- Event share slug
alter table public.events
  add column if not exists slug text;

update public.events
set slug = lower(regexp_replace(coalesce(title, 'event'), '[^a-zA-Z0-9]+', '-', 'g'))
           || '-' || substr(replace(id::text, '-', ''), 1, 8)
where slug is null or slug = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_slug_unique'
  ) then
    alter table public.events add constraint events_slug_unique unique (slug);
  end if;
end $$;

create index if not exists events_slug_idx on public.events (slug);
create index if not exists events_published_starts_idx on public.events (is_published, starts_at)
  where is_published = true;

alter table public.plan_label_presets enable row level security;
alter table public.plan_checklist_templates enable row level security;
alter table public.plan_checklist_template_items enable row level security;
alter table public.ops_forms enable row level security;
alter table public.ops_form_submissions enable row level security;

drop policy if exists plan_label_presets_select on public.plan_label_presets;
create policy plan_label_presets_select on public.plan_label_presets
  for select to authenticated using (public.is_admin());
drop policy if exists plan_label_presets_write on public.plan_label_presets;
create policy plan_label_presets_write on public.plan_label_presets
  for all to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());

drop policy if exists plan_checklist_templates_select on public.plan_checklist_templates;
create policy plan_checklist_templates_select on public.plan_checklist_templates
  for select to authenticated using (public.is_admin());
drop policy if exists plan_checklist_templates_write on public.plan_checklist_templates;
create policy plan_checklist_templates_write on public.plan_checklist_templates
  for all to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());

drop policy if exists plan_checklist_template_items_select on public.plan_checklist_template_items;
create policy plan_checklist_template_items_select on public.plan_checklist_template_items
  for select to authenticated using (public.is_admin());
drop policy if exists plan_checklist_template_items_write on public.plan_checklist_template_items;
create policy plan_checklist_template_items_write on public.plan_checklist_template_items
  for all to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());

drop policy if exists ops_forms_select on public.ops_forms;
create policy ops_forms_select on public.ops_forms
  for select to authenticated using (public.is_admin());
drop policy if exists ops_forms_write on public.ops_forms;
create policy ops_forms_write on public.ops_forms
  for all to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());

drop policy if exists ops_form_submissions_select on public.ops_form_submissions;
create policy ops_form_submissions_select on public.ops_form_submissions
  for select to authenticated using (public.is_admin());
drop policy if exists ops_form_submissions_write on public.ops_form_submissions;
create policy ops_form_submissions_write on public.ops_form_submissions
  for all to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());

grant select, insert, update, delete on public.plan_label_presets to authenticated;
grant select, insert, update, delete on public.plan_checklist_templates to authenticated;
grant select, insert, update, delete on public.plan_checklist_template_items to authenticated;
grant select, insert, update, delete on public.ops_forms to authenticated;
grant select, insert, update, delete on public.ops_form_submissions to authenticated;

-- Seed label presets (idempotent)
insert into public.plan_label_presets (name, color, position)
values
  ('Marketing', '#f97316', 0),
  ('Ops', '#38bdf8', 1),
  ('Legal', '#4ade80', 2),
  ('Design', '#a78bfa', 3),
  ('Production', '#fb7185', 4)
on conflict (name) do nothing;

-- Seed complaint form
insert into public.ops_forms (name, kind, fields)
select
  'Customer complaint',
  'complaint',
  '[
    {"key":"customer_name","label":"Customer name","type":"text","required":true},
    {"key":"branch","label":"Branch","type":"text","required":true},
    {"key":"category","label":"Category","type":"text","required":true},
    {"key":"description","label":"Description","type":"textarea","required":true}
  ]'::jsonb
where not exists (select 1 from public.ops_forms where kind = 'complaint' limit 1);
