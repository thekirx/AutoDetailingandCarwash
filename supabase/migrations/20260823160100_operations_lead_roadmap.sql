-- Collaborative roadmap boards for SA / ASA / BA / Operations Lead.

create or replace function public.can_access_ops_roadmap()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select sp.role::text in (
        'BossMich',
        'assistant_super_admin',
        'admin',
        'operations_lead'
      )
      from public.staff_profiles sp
      where sp.id = auth.uid()
        and coalesce(sp.is_active, true)
      limit 1
    ),
    false
  );
$$;

revoke all on function public.can_access_ops_roadmap() from public, anon;
grant execute on function public.can_access_ops_roadmap() to authenticated;

create table if not exists public.ops_roadmap_boards (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled roadmap',
  description text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  updated_by uuid references public.staff_profiles (id) on delete set null,
  viewport jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_roadmap_boards_active_idx
  on public.ops_roadmap_boards (updated_at desc)
  where not is_archived;

create table if not exists public.ops_roadmap_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.ops_roadmap_boards (id) on delete cascade,
  kind text not null default 'note'
    check (kind in ('note', 'heading', 'frame')),
  title text not null default '',
  body text not null default '',
  color text not null default 'amber',
  x numeric not null default 80,
  y numeric not null default 80,
  w numeric not null default 220 check (w >= 120 and w <= 720),
  h numeric not null default 160 check (h >= 80 and h <= 640),
  z_index integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid references public.staff_profiles (id) on delete set null,
  updated_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_roadmap_items_board_idx
  on public.ops_roadmap_items (board_id, z_index, updated_at desc);

alter table public.ops_roadmap_boards enable row level security;
alter table public.ops_roadmap_items enable row level security;

drop policy if exists ops_roadmap_boards_select on public.ops_roadmap_boards;
create policy ops_roadmap_boards_select
  on public.ops_roadmap_boards for select to authenticated
  using (public.can_access_ops_roadmap());

drop policy if exists ops_roadmap_boards_insert on public.ops_roadmap_boards;
create policy ops_roadmap_boards_insert
  on public.ops_roadmap_boards for insert to authenticated
  with check (public.can_access_ops_roadmap() and created_by = auth.uid());

drop policy if exists ops_roadmap_boards_update on public.ops_roadmap_boards;
create policy ops_roadmap_boards_update
  on public.ops_roadmap_boards for update to authenticated
  using (public.can_access_ops_roadmap())
  with check (public.can_access_ops_roadmap());

drop policy if exists ops_roadmap_boards_delete on public.ops_roadmap_boards;
create policy ops_roadmap_boards_delete
  on public.ops_roadmap_boards for delete to authenticated
  using (
    public.can_access_ops_roadmap()
    and (
      created_by = auth.uid()
      or public.current_user_role()::text = 'BossMich'
    )
  );

drop policy if exists ops_roadmap_items_select on public.ops_roadmap_items;
create policy ops_roadmap_items_select
  on public.ops_roadmap_items for select to authenticated
  using (public.can_access_ops_roadmap());

drop policy if exists ops_roadmap_items_insert on public.ops_roadmap_items;
create policy ops_roadmap_items_insert
  on public.ops_roadmap_items for insert to authenticated
  with check (public.can_access_ops_roadmap() and created_by = auth.uid());

drop policy if exists ops_roadmap_items_update on public.ops_roadmap_items;
create policy ops_roadmap_items_update
  on public.ops_roadmap_items for update to authenticated
  using (public.can_access_ops_roadmap())
  with check (public.can_access_ops_roadmap());

drop policy if exists ops_roadmap_items_delete on public.ops_roadmap_items;
create policy ops_roadmap_items_delete
  on public.ops_roadmap_items for delete to authenticated
  using (public.can_access_ops_roadmap());

grant select, insert, update, delete on public.ops_roadmap_boards to authenticated;
grant select, insert, update, delete on public.ops_roadmap_items to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.ops_roadmap_boards;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.ops_roadmap_items;
  exception when duplicate_object then null;
  end;
end $$;

comment on table public.ops_roadmap_boards is
  'Shared ops brainstorming / roadmap boards (SA, ASA, BA, Operations Lead).';
comment on table public.ops_roadmap_items is
  'Freeform sticky notes and headings on an ops roadmap board.';
