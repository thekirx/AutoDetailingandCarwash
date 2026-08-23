-- Ops Lab enrichment: board kinds (plan/roadmap/solution), status, complaint/form links, notify helper.

alter table public.ops_roadmap_boards
  add column if not exists board_kind text not null default 'brainstorm',
  add column if not exists status text not null default 'open',
  add column if not exists priority text not null default 'normal',
  add column if not exists branch_slug text,
  add column if not exists linked_form_submission_id uuid
    references public.ops_form_submissions (id) on delete set null;

do $$
begin
  alter table public.ops_roadmap_boards
    drop constraint if exists ops_roadmap_boards_board_kind_check;
  alter table public.ops_roadmap_boards
    add constraint ops_roadmap_boards_board_kind_check
    check (board_kind in ('brainstorm', 'plan', 'roadmap', 'solution'));

  alter table public.ops_roadmap_boards
    drop constraint if exists ops_roadmap_boards_status_check;
  alter table public.ops_roadmap_boards
    add constraint ops_roadmap_boards_status_check
    check (status in ('open', 'in_progress', 'done'));

  alter table public.ops_roadmap_boards
    drop constraint if exists ops_roadmap_boards_priority_check;
  alter table public.ops_roadmap_boards
    add constraint ops_roadmap_boards_priority_check
    check (priority in ('low', 'normal', 'high'));
exception when others then
  raise notice 'board constraints: %', sqlerrm;
end $$;

create index if not exists ops_roadmap_boards_kind_status_idx
  on public.ops_roadmap_boards (board_kind, status, updated_at desc)
  where not is_archived;

-- Expand item kinds for complaint / form / external links
alter table public.ops_roadmap_items
  drop constraint if exists ops_roadmap_items_kind_check;

alter table public.ops_roadmap_items
  add constraint ops_roadmap_items_kind_check
  check (kind in ('note', 'heading', 'frame', 'complaint_link', 'form_link', 'action'));

alter table public.ops_roadmap_items
  add column if not exists item_status text not null default 'open';

do $$
begin
  alter table public.ops_roadmap_items
    drop constraint if exists ops_roadmap_items_item_status_check;
  alter table public.ops_roadmap_items
    add constraint ops_roadmap_items_item_status_check
    check (item_status in ('open', 'doing', 'done'));
exception when others then null;
end $$;

-- Resolve Ops Lab collaborators (SA / ASA / BA / Operations Lead)
create or replace function public.resolve_ops_lab_notify_user_ids(exclude_user uuid default null)
returns uuid[]
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(sp.id), '{}'::uuid[])
  from public.staff_profiles sp
  where coalesce(sp.is_active, true)
    and sp.role::text in (
      'BossMich',
      'assistant_super_admin',
      'admin',
      'operations_lead'
    )
    and (exclude_user is null or sp.id is distinct from exclude_user);
$$;

revoke all on function public.resolve_ops_lab_notify_user_ids(uuid) from public, anon;
grant execute on function public.resolve_ops_lab_notify_user_ids(uuid) to authenticated;

comment on column public.ops_roadmap_boards.board_kind is
  'Ops Lab board type: brainstorm | plan | roadmap | solution';
comment on column public.ops_roadmap_items.kind is
  'Canvas card: note | heading | frame | complaint_link | form_link | action';
