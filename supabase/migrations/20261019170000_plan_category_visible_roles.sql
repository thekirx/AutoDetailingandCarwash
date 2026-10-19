-- Michi C13: SA/ASA choose which roles see each planner category.

begin;

alter table public.plan_categories
  add column if not exists visible_roles text[] not null default '{}'::text[];

comment on column public.plan_categories.visible_roles is
  'Empty = every planner role. Otherwise only listed roles see the category on the board.';

commit;
