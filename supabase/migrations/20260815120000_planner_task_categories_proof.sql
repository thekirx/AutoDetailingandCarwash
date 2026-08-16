-- Planner Task module: categories, Branch Admin write, assignee assign, proof storage.

create or replace function public.can_edit_planning()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    public.is_super_admin()
    or public.current_user_role() = 'admin'
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

create table if not exists public.plan_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#052699',
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint plan_categories_name_unique unique (name)
);

create index if not exists plan_categories_pos_idx on public.plan_categories (position);

alter table public.plan_cards
  add column if not exists category_id uuid references public.plan_categories (id) on delete set null;

create index if not exists plan_cards_category_idx on public.plan_cards (category_id);

create index if not exists plan_card_assignees_review_idx
  on public.plan_card_assignees (status, proof_submitted_at desc)
  where status = 'for_review';

insert into public.plan_categories (name, color, position)
select p.name, p.color, p.position
from public.plan_label_presets p
where not exists (select 1 from public.plan_categories c where c.name = p.name);

alter table public.plan_categories enable row level security;

drop policy if exists plan_categories_select on public.plan_categories;
create policy plan_categories_select on public.plan_categories
  for select to authenticated using (true);

drop policy if exists plan_categories_write on public.plan_categories;
create policy plan_categories_write on public.plan_categories
  for all to authenticated
  using (public.can_edit_planning())
  with check (public.can_edit_planning());

grant select, insert, update, delete on public.plan_categories to authenticated;

drop policy if exists plan_card_assignees_write on public.plan_card_assignees;
create policy plan_card_assignees_write on public.plan_card_assignees
  for all to authenticated
  using (public.can_edit_planning())
  with check (public.can_edit_planning());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'plan-proofs',
  'plan-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

drop policy if exists plan_proofs_select on storage.objects;
create policy plan_proofs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'plan-proofs'
    and (
      public.can_edit_planning()
      or public.is_admin()
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

drop policy if exists plan_proofs_insert on storage.objects;
create policy plan_proofs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plan-proofs'
    and (
      public.can_edit_planning()
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

drop policy if exists plan_proofs_update on storage.objects;
create policy plan_proofs_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'plan-proofs'
    and (
      public.can_edit_planning()
      or split_part(name, '/', 1) = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'plan-proofs'
    and (
      public.can_edit_planning()
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );
