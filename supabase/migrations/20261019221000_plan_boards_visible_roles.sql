-- Planner boards: who can see each board (same empty=everyone semantics as plan_categories).
-- Cash Advance boards are seeded so TL / Branch Admin / Marketing / Customer Rep cannot see them.

begin;

alter table public.plan_boards
  add column if not exists visible_roles text[] not null default '{}'::text[];

comment on column public.plan_boards.visible_roles is
  'Empty = every planner role. Otherwise only listed roles see the board tabs.';

-- Roles that may see Cash Advance (19 Oct matrix: not TL, BA, marketing, sales).
update public.plan_boards
set visible_roles = array[
  'BossMich',
  'assistant_super_admin',
  'operations_lead',
  'staff',
  'detailer',
  'video_editor',
  'investor'
]::text[]
where visible_roles = '{}'::text[]
  and name ~* 'cash\s*advance';

commit;
