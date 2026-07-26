-- Part 4: crew username + planning card assignees (My Tasks)

alter table public.staff_profiles
  add column if not exists username text;

-- Unique usernames when set (case-insensitive)
create unique index if not exists staff_profiles_username_lower_uidx
  on public.staff_profiles (lower(username))
  where username is not null and btrim(username) <> '';

create table if not exists public.plan_card_assignees (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.plan_cards (id) on delete cascade,
  staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  notes text not null default '',
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, staff_id)
);

create index if not exists plan_card_assignees_staff_status_idx
  on public.plan_card_assignees (staff_id, status);

create index if not exists plan_card_assignees_card_idx
  on public.plan_card_assignees (card_id);

alter table public.plan_card_assignees enable row level security;

-- Admins (BossMich / admin / assistant) see all assignees; staff see own
drop policy if exists plan_card_assignees_select on public.plan_card_assignees;
create policy plan_card_assignees_select on public.plan_card_assignees
  for select to authenticated
  using (public.is_admin() or staff_id = (select auth.uid()));

-- BossMich (and planning editors who are super) full CRUD
drop policy if exists plan_card_assignees_write on public.plan_card_assignees;
create policy plan_card_assignees_write on public.plan_card_assignees
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Assignees may update their own status/notes
drop policy if exists plan_card_assignees_self_update on public.plan_card_assignees;
create policy plan_card_assignees_self_update on public.plan_card_assignees
  for update to authenticated
  using (staff_id = (select auth.uid()))
  with check (staff_id = (select auth.uid()));

grant select, insert, update, delete on public.plan_card_assignees to authenticated;

-- Assignees can read cards (and checklist) they are assigned to
drop policy if exists plan_cards_select_assignee on public.plan_cards;
create policy plan_cards_select_assignee on public.plan_cards
  for select to authenticated
  using (
    exists (
      select 1 from public.plan_card_assignees a
      where a.card_id = plan_cards.id
        and a.staff_id = (select auth.uid())
    )
  );

drop policy if exists plan_checklist_select_assignee on public.plan_checklist_items;
create policy plan_checklist_select_assignee on public.plan_checklist_items
  for select to authenticated
  using (
    exists (
      select 1 from public.plan_card_assignees a
      where a.card_id = plan_checklist_items.card_id
        and a.staff_id = (select auth.uid())
    )
  );

-- Assignees can toggle checklist items on their cards
drop policy if exists plan_checklist_update_assignee on public.plan_checklist_items;
create policy plan_checklist_update_assignee on public.plan_checklist_items
  for update to authenticated
  using (
    exists (
      select 1 from public.plan_card_assignees a
      where a.card_id = plan_checklist_items.card_id
        and a.staff_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.plan_card_assignees a
      where a.card_id = plan_checklist_items.card_id
        and a.staff_id = (select auth.uid())
    )
  );

-- Lists/boards readable when user has an assignment on that board
drop policy if exists plan_lists_select_assignee on public.plan_lists;
create policy plan_lists_select_assignee on public.plan_lists
  for select to authenticated
  using (
    exists (
      select 1
      from public.plan_cards c
      join public.plan_card_assignees a on a.card_id = c.id
      where c.list_id = plan_lists.id
        and a.staff_id = (select auth.uid())
    )
  );

drop policy if exists plan_boards_select_assignee on public.plan_boards;
create policy plan_boards_select_assignee on public.plan_boards
  for select to authenticated
  using (
    exists (
      select 1
      from public.plan_lists l
      join public.plan_cards c on c.list_id = l.id
      join public.plan_card_assignees a on a.card_id = c.id
      where l.board_id = plan_boards.id
        and a.staff_id = (select auth.uid())
    )
  );
