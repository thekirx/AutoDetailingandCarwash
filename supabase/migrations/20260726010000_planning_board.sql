-- Hakum planning board (Trello-like). Super Admin CRUD; Admin read-only.
-- Indexes on board_id/list_id/due_at for query performance (supabase-postgres best practices).

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select public.current_user_role() = 'BossMich';
$$;

create table if not exists public.plan_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.plan_boards (id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plan_lists_board_pos_idx on public.plan_lists (board_id, position);

create table if not exists public.plan_cards (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.plan_lists (id) on delete cascade,
  title text not null,
  description text not null default '',
  due_at timestamptz,
  position int not null default 0,
  -- ponytail: labels as jsonb [{name,color}] until a shared label catalog is needed
  labels jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_cards_labels_is_array check (jsonb_typeof(labels) = 'array')
);

create index if not exists plan_cards_list_pos_idx on public.plan_cards (list_id, position);
create index if not exists plan_cards_due_at_idx on public.plan_cards (due_at) where due_at is not null;

create table if not exists public.plan_checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.plan_cards (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plan_checklist_card_pos_idx on public.plan_checklist_items (card_id, position);

alter table public.plan_boards enable row level security;
alter table public.plan_lists enable row level security;
alter table public.plan_cards enable row level security;
alter table public.plan_checklist_items enable row level security;

drop policy if exists plan_boards_select on public.plan_boards;
create policy plan_boards_select on public.plan_boards for select to authenticated using (public.is_admin());
drop policy if exists plan_lists_select on public.plan_lists;
create policy plan_lists_select on public.plan_lists for select to authenticated using (public.is_admin());
drop policy if exists plan_cards_select on public.plan_cards;
create policy plan_cards_select on public.plan_cards for select to authenticated using (public.is_admin());
drop policy if exists plan_checklist_select on public.plan_checklist_items;
create policy plan_checklist_select on public.plan_checklist_items for select to authenticated using (public.is_admin());

drop policy if exists plan_boards_write on public.plan_boards;
create policy plan_boards_write on public.plan_boards for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists plan_lists_write on public.plan_lists;
create policy plan_lists_write on public.plan_lists for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists plan_cards_write on public.plan_cards;
create policy plan_cards_write on public.plan_cards for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists plan_checklist_write on public.plan_checklist_items;
create policy plan_checklist_write on public.plan_checklist_items for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

grant select on public.plan_boards, public.plan_lists, public.plan_cards, public.plan_checklist_items to authenticated;
grant insert, update, delete on public.plan_boards, public.plan_lists, public.plan_cards, public.plan_checklist_items to authenticated;

do $$
declare
  bid uuid;
begin
  if not exists (select 1 from public.plan_boards) then
    insert into public.plan_boards (name) values ('Hakum Planning') returning id into bid;
    insert into public.plan_lists (board_id, title, position) values
      (bid, 'Upcoming', 0),
      (bid, 'In Progress', 1),
      (bid, 'Done', 2);
  end if;
end $$;
