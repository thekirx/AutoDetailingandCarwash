-- Ops Lab: customizable types + statuses, drop hard CHECKs, audit every mutation.
-- Indexes for filter/sort (query-missing-indexes). RLS mirrors can_access_ops_roadmap.

-- ── Catalog: suggestion types (board_kind) ──────────────────────────────────
create table if not exists public.ops_lab_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  hint text not null default '',
  sort_order integer not null default 100,
  is_system boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid references public.staff_profiles (id) on delete set null,
  updated_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_lab_types_slug_format check (slug ~ '^[a-z][a-z0-9_]{0,47}$'),
  constraint ops_lab_types_label_len check (char_length(trim(label)) between 1 and 64)
);

create unique index if not exists ops_lab_types_slug_uidx
  on public.ops_lab_types (slug);
create index if not exists ops_lab_types_active_sort_idx
  on public.ops_lab_types (sort_order, label)
  where not is_archived;

-- ── Catalog: item statuses ──────────────────────────────────────────────────
create table if not exists public.ops_lab_statuses (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  label text not null,
  badge text not null default 'outline'
    check (badge in ('outline', 'default', 'secondary', 'destructive')),
  sort_order integer not null default 100,
  is_system boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid references public.staff_profiles (id) on delete set null,
  updated_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ops_lab_statuses_slug_format check (slug ~ '^[a-z][a-z0-9_]{0,47}$'),
  constraint ops_lab_statuses_label_len check (char_length(trim(label)) between 1 and 64)
);

create unique index if not exists ops_lab_statuses_slug_uidx
  on public.ops_lab_statuses (slug);
create index if not exists ops_lab_statuses_active_sort_idx
  on public.ops_lab_statuses (sort_order, label)
  where not is_archived;

-- Seed defaults (idempotent)
insert into public.ops_lab_types (slug, label, hint, sort_order, is_system)
values
  ('brainstorm', 'Brainstorm', 'Open ideas', 10, true),
  ('plan', 'Plan', 'Dated execution plan', 20, true),
  ('roadmap', 'Roadmap', 'Quarter / horizon', 30, true),
  ('solution', 'Solution', 'Fix tied to a pain', 40, true)
on conflict (slug) do nothing;

insert into public.ops_lab_statuses (slug, label, badge, sort_order, is_system)
values
  ('open', 'Open', 'outline', 10, true),
  ('doing', 'Doing', 'default', 20, true),
  ('done', 'Done', 'secondary', 30, true)
on conflict (slug) do nothing;

-- Allow custom slugs on boards/items (catalog is source of truth in app)
alter table public.ops_roadmap_boards
  drop constraint if exists ops_roadmap_boards_board_kind_check;

alter table public.ops_roadmap_items
  drop constraint if exists ops_roadmap_items_item_status_check;

create index if not exists ops_roadmap_items_status_updated_idx
  on public.ops_roadmap_items (item_status, updated_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.ops_lab_types enable row level security;
alter table public.ops_lab_statuses enable row level security;

drop policy if exists ops_lab_types_select on public.ops_lab_types;
create policy ops_lab_types_select
  on public.ops_lab_types for select to authenticated
  using (public.can_access_ops_roadmap());

drop policy if exists ops_lab_types_insert on public.ops_lab_types;
create policy ops_lab_types_insert
  on public.ops_lab_types for insert to authenticated
  with check (public.can_access_ops_roadmap());

drop policy if exists ops_lab_types_update on public.ops_lab_types;
create policy ops_lab_types_update
  on public.ops_lab_types for update to authenticated
  using (public.can_access_ops_roadmap())
  with check (public.can_access_ops_roadmap());

drop policy if exists ops_lab_types_delete on public.ops_lab_types;
create policy ops_lab_types_delete
  on public.ops_lab_types for delete to authenticated
  using (public.can_access_ops_roadmap() and not is_system);

drop policy if exists ops_lab_statuses_select on public.ops_lab_statuses;
create policy ops_lab_statuses_select
  on public.ops_lab_statuses for select to authenticated
  using (public.can_access_ops_roadmap());

drop policy if exists ops_lab_statuses_insert on public.ops_lab_statuses;
create policy ops_lab_statuses_insert
  on public.ops_lab_statuses for insert to authenticated
  with check (public.can_access_ops_roadmap());

drop policy if exists ops_lab_statuses_update on public.ops_lab_statuses;
create policy ops_lab_statuses_update
  on public.ops_lab_statuses for update to authenticated
  using (public.can_access_ops_roadmap())
  with check (public.can_access_ops_roadmap());

drop policy if exists ops_lab_statuses_delete on public.ops_lab_statuses;
create policy ops_lab_statuses_delete
  on public.ops_lab_statuses for delete to authenticated
  using (public.can_access_ops_roadmap() and not is_system);

grant select, insert, update, delete on public.ops_lab_types to authenticated;
grant select, insert, update, delete on public.ops_lab_statuses to authenticated;

-- ── Audit helper (security definer — SA sees via audit_logs) ────────────────
create or replace function public.ops_lab_write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_summary text,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
begin
  if nullif(trim(p_action), '') is null or nullif(trim(p_entity_type), '') is null then
    return;
  end if;
  if caller_id is not null then
    select sp.role::text into caller_role
    from public.staff_profiles sp
    where sp.id = caller_id and coalesce(sp.is_active, true)
    limit 1;
  end if;
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller_id,
    caller_role,
    trim(p_action),
    trim(p_entity_type),
    nullif(trim(p_entity_id), ''),
    coalesce(nullif(trim(p_summary), ''), trim(p_action)),
    coalesce(p_meta, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.ops_lab_write_audit(text, text, text, text, jsonb) from public, anon;
grant execute on function public.ops_lab_write_audit(text, text, text, text, jsonb) to authenticated;

create or replace function public.ops_lab_audit_items_trg()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.ops_lab_write_audit(
      'ops_lab.item_created',
      'ops_roadmap_item',
      new.id::text,
      'Ops Lab suggestion created: ' || coalesce(nullif(trim(new.title), ''), '(untitled)'),
      jsonb_build_object(
        'board_id', new.board_id,
        'kind', new.kind,
        'item_status', new.item_status,
        'title', new.title
      )
    );
    return new;
  end if;
  if TG_OP = 'DELETE' then
    perform public.ops_lab_write_audit(
      'ops_lab.item_deleted',
      'ops_roadmap_item',
      old.id::text,
      'Ops Lab suggestion deleted: ' || coalesce(nullif(trim(old.title), ''), '(untitled)'),
      jsonb_build_object(
        'board_id', old.board_id,
        'kind', old.kind,
        'item_status', old.item_status,
        'title', old.title
      )
    );
    return old;
  end if;
  -- UPDATE
  if old.item_status is distinct from new.item_status then
    perform public.ops_lab_write_audit(
      'ops_lab.status_changed',
      'ops_roadmap_item',
      new.id::text,
      format(
        'Ops Lab status %s → %s: %s',
        coalesce(old.item_status, '?'),
        coalesce(new.item_status, '?'),
        coalesce(nullif(trim(new.title), ''), '(untitled)')
      ),
      jsonb_build_object(
        'board_id', new.board_id,
        'from_status', old.item_status,
        'to_status', new.item_status,
        'title', new.title
      )
    );
  elsif old.title is distinct from new.title
     or old.body is distinct from new.body
     or old.meta is distinct from new.meta
     or old.kind is distinct from new.kind then
    perform public.ops_lab_write_audit(
      'ops_lab.item_updated',
      'ops_roadmap_item',
      new.id::text,
      'Ops Lab suggestion updated: ' || coalesce(nullif(trim(new.title), ''), '(untitled)'),
      jsonb_build_object(
        'board_id', new.board_id,
        'title', new.title,
        'item_status', new.item_status
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ops_lab_audit_items on public.ops_roadmap_items;
create trigger trg_ops_lab_audit_items
  after insert or update or delete on public.ops_roadmap_items
  for each row execute function public.ops_lab_audit_items_trg();

create or replace function public.ops_lab_audit_catalog_trg()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ent text := TG_TABLE_NAME;
  row_id text;
  slug_v text;
  label_v text;
begin
  if TG_OP = 'DELETE' then
    row_id := old.id::text;
    slug_v := old.slug;
    label_v := old.label;
    perform public.ops_lab_write_audit(
      'ops_lab.catalog_deleted',
      ent,
      row_id,
      format('Ops Lab %s deleted: %s (%s)', ent, label_v, slug_v),
      jsonb_build_object('slug', slug_v, 'label', label_v)
    );
    return old;
  end if;
  row_id := new.id::text;
  slug_v := new.slug;
  label_v := new.label;
  if TG_OP = 'INSERT' then
    perform public.ops_lab_write_audit(
      'ops_lab.catalog_created',
      ent,
      row_id,
      format('Ops Lab %s created: %s (%s)', ent, label_v, slug_v),
      jsonb_build_object('slug', slug_v, 'label', label_v, 'sort_order', new.sort_order)
    );
  else
    perform public.ops_lab_write_audit(
      'ops_lab.catalog_updated',
      ent,
      row_id,
      format('Ops Lab %s updated: %s (%s)', ent, label_v, slug_v),
      jsonb_build_object(
        'slug', slug_v,
        'label', label_v,
        'is_archived', new.is_archived,
        'sort_order', new.sort_order
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ops_lab_audit_types on public.ops_lab_types;
create trigger trg_ops_lab_audit_types
  after insert or update or delete on public.ops_lab_types
  for each row execute function public.ops_lab_audit_catalog_trg();

drop trigger if exists trg_ops_lab_audit_statuses on public.ops_lab_statuses;
create trigger trg_ops_lab_audit_statuses
  after insert or update or delete on public.ops_lab_statuses
  for each row execute function public.ops_lab_audit_catalog_trg();

comment on table public.ops_lab_types is
  'Customizable Ops Lab suggestion types (board_kind slugs).';
comment on table public.ops_lab_statuses is
  'Customizable Ops Lab suggestion statuses (item_status slugs).';
-- Audit visibility stays on existing audit_logs admin policy (SA Audit page only).
