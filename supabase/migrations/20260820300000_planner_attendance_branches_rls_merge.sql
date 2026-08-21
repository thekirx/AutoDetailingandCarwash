-- Slice T: OPT-09 planner/attendance/branches + B-35/B-36.
-- B-35: can_edit_planning uses asa_has_grant (InitPlan-friendly).
-- B-36: staff_attendance SELECT uses can_manage_branch (not bare is_admin).

create or replace function public.can_edit_planning()
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select
    public.is_super_admin()
    or public.current_user_role() = 'admin'
    or public.asa_has_grant('planning_edit');
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- branches — one SELECT for anon+authenticated
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "Anon can read active branches" on public.branches;
drop policy if exists "Authenticated can read active branches" on public.branches;
drop policy if exists "Authenticated users can read authorized branches" on public.branches;
drop policy if exists "Public can read active branches" on public.branches;

create policy branches_select
  on public.branches
  for select
  to anon, authenticated
  using (
    (not is_archived and (is_active or coming_soon))
    or (
      (select auth.uid()) is not null
      and (
        public.is_admin()
        or slug = public.current_user_branch()
        or public.user_has_branch_access(slug)
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- staff_attendance
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "Queue managers can insert staff attendance" on public.staff_attendance;
drop policy if exists "Staff can insert own attendance" on public.staff_attendance;
drop policy if exists "Authorized users can read staff attendance" on public.staff_attendance;
drop policy if exists "Queue managers can update staff attendance" on public.staff_attendance;
drop policy if exists "Staff can update own attendance" on public.staff_attendance;

create policy staff_attendance_select
  on public.staff_attendance
  for select
  to authenticated
  using (
    staff_id = (select auth.uid())
    or public.can_manage_branch(branch_slug)
  );

create policy staff_attendance_insert
  on public.staff_attendance
  for insert
  to authenticated
  with check (
    public.can_manage_branch(branch_slug)
    or (
      staff_id = (select auth.uid())
      and public.user_has_branch_access(branch_slug)
    )
  );

create policy staff_attendance_update
  on public.staff_attendance
  for update
  to authenticated
  using (
    public.can_manage_branch(branch_slug)
    or staff_id = (select auth.uid())
  )
  with check (
    public.can_manage_branch(branch_slug)
    or (
      staff_id = (select auth.uid())
      and public.user_has_branch_access(branch_slug)
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- planner: split FOR ALL writes; merge SELECT (+ assignee self-update)
-- ═══════════════════════════════════════════════════════════════════════

-- plan_boards
drop policy if exists plan_boards_write on public.plan_boards;
drop policy if exists plan_boards_select on public.plan_boards;
drop policy if exists plan_boards_select_assignee on public.plan_boards;

create policy plan_boards_select
  on public.plan_boards
  for select
  to authenticated
  using (
    public.can_edit_planning()
    or public.is_admin()
    or exists (
      select 1
      from public.plan_lists l
      join public.plan_cards c on c.list_id = l.id
      join public.plan_card_assignees a on a.card_id = c.id
      where l.board_id = plan_boards.id
        and a.staff_id = (select auth.uid())
    )
  );

create policy plan_boards_insert
  on public.plan_boards for insert to authenticated
  with check (public.can_edit_planning());
create policy plan_boards_update
  on public.plan_boards for update to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());
create policy plan_boards_delete
  on public.plan_boards for delete to authenticated
  using (public.can_edit_planning());

-- plan_lists
drop policy if exists plan_lists_write on public.plan_lists;
drop policy if exists plan_lists_select on public.plan_lists;
drop policy if exists plan_lists_select_assignee on public.plan_lists;

create policy plan_lists_select
  on public.plan_lists
  for select
  to authenticated
  using (
    public.can_edit_planning()
    or public.is_admin()
    or exists (
      select 1
      from public.plan_cards c
      join public.plan_card_assignees a on a.card_id = c.id
      where c.list_id = plan_lists.id
        and a.staff_id = (select auth.uid())
    )
  );

create policy plan_lists_insert
  on public.plan_lists for insert to authenticated
  with check (public.can_edit_planning());
create policy plan_lists_update
  on public.plan_lists for update to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());
create policy plan_lists_delete
  on public.plan_lists for delete to authenticated
  using (public.can_edit_planning());

-- plan_cards
drop policy if exists plan_cards_write on public.plan_cards;
drop policy if exists plan_cards_select on public.plan_cards;
drop policy if exists plan_cards_select_assignee on public.plan_cards;

create policy plan_cards_select
  on public.plan_cards
  for select
  to authenticated
  using (
    public.can_edit_planning()
    or public.is_admin()
    or exists (
      select 1
      from public.plan_card_assignees a
      where a.card_id = plan_cards.id
        and a.staff_id = (select auth.uid())
    )
  );

create policy plan_cards_insert
  on public.plan_cards for insert to authenticated
  with check (public.can_edit_planning());
create policy plan_cards_update
  on public.plan_cards for update to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());
create policy plan_cards_delete
  on public.plan_cards for delete to authenticated
  using (public.can_edit_planning());

-- plan_card_assignees
drop policy if exists plan_card_assignees_write on public.plan_card_assignees;
drop policy if exists plan_card_assignees_select on public.plan_card_assignees;
drop policy if exists plan_card_assignees_self_update on public.plan_card_assignees;

create policy plan_card_assignees_select
  on public.plan_card_assignees
  for select
  to authenticated
  using (
    public.can_edit_planning()
    or public.is_admin()
    or staff_id = (select auth.uid())
  );

create policy plan_card_assignees_insert
  on public.plan_card_assignees for insert to authenticated
  with check (public.can_edit_planning());

create policy plan_card_assignees_update
  on public.plan_card_assignees
  for update
  to authenticated
  using (
    public.can_edit_planning()
    or staff_id = (select auth.uid())
  )
  with check (
    public.can_edit_planning()
    or staff_id = (select auth.uid())
  );

create policy plan_card_assignees_delete
  on public.plan_card_assignees for delete to authenticated
  using (public.can_edit_planning());

-- plan_checklist_items
drop policy if exists plan_checklist_write on public.plan_checklist_items;
drop policy if exists plan_checklist_select on public.plan_checklist_items;
drop policy if exists plan_checklist_select_assignee on public.plan_checklist_items;
drop policy if exists plan_checklist_update_assignee on public.plan_checklist_items;

create policy plan_checklist_items_select
  on public.plan_checklist_items
  for select
  to authenticated
  using (
    public.can_edit_planning()
    or public.is_admin()
    or exists (
      select 1
      from public.plan_card_assignees a
      where a.card_id = plan_checklist_items.card_id
        and a.staff_id = (select auth.uid())
    )
  );

create policy plan_checklist_items_insert
  on public.plan_checklist_items for insert to authenticated
  with check (public.can_edit_planning());

create policy plan_checklist_items_update
  on public.plan_checklist_items
  for update
  to authenticated
  using (
    public.can_edit_planning()
    or exists (
      select 1
      from public.plan_card_assignees a
      where a.card_id = plan_checklist_items.card_id
        and a.staff_id = (select auth.uid())
    )
  )
  with check (
    public.can_edit_planning()
    or exists (
      select 1
      from public.plan_card_assignees a
      where a.card_id = plan_checklist_items.card_id
        and a.staff_id = (select auth.uid())
    )
  );

create policy plan_checklist_items_delete
  on public.plan_checklist_items for delete to authenticated
  using (public.can_edit_planning());

-- plan_categories
drop policy if exists plan_categories_write on public.plan_categories;
-- keep open read; only split write
create policy plan_categories_insert
  on public.plan_categories for insert to authenticated
  with check (public.can_edit_planning());
create policy plan_categories_update
  on public.plan_categories for update to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());
create policy plan_categories_delete
  on public.plan_categories for delete to authenticated
  using (public.can_edit_planning());

-- plan_label_presets
drop policy if exists plan_label_presets_write on public.plan_label_presets;
drop policy if exists plan_label_presets_select on public.plan_label_presets;

create policy plan_label_presets_select
  on public.plan_label_presets for select to authenticated
  using (public.can_edit_planning() or public.is_admin());
create policy plan_label_presets_insert
  on public.plan_label_presets for insert to authenticated
  with check (public.can_edit_planning());
create policy plan_label_presets_update
  on public.plan_label_presets for update to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());
create policy plan_label_presets_delete
  on public.plan_label_presets for delete to authenticated
  using (public.can_edit_planning());

-- plan_checklist_templates
drop policy if exists plan_checklist_templates_write on public.plan_checklist_templates;
drop policy if exists plan_checklist_templates_select on public.plan_checklist_templates;

create policy plan_checklist_templates_select
  on public.plan_checklist_templates for select to authenticated
  using (public.can_edit_planning() or public.is_admin());
create policy plan_checklist_templates_insert
  on public.plan_checklist_templates for insert to authenticated
  with check (public.can_edit_planning());
create policy plan_checklist_templates_update
  on public.plan_checklist_templates for update to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());
create policy plan_checklist_templates_delete
  on public.plan_checklist_templates for delete to authenticated
  using (public.can_edit_planning());

-- plan_checklist_template_items
drop policy if exists plan_checklist_template_items_write on public.plan_checklist_template_items;
drop policy if exists plan_checklist_template_items_select on public.plan_checklist_template_items;

create policy plan_checklist_template_items_select
  on public.plan_checklist_template_items for select to authenticated
  using (public.can_edit_planning() or public.is_admin());
create policy plan_checklist_template_items_insert
  on public.plan_checklist_template_items for insert to authenticated
  with check (public.can_edit_planning());
create policy plan_checklist_template_items_update
  on public.plan_checklist_template_items for update to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());
create policy plan_checklist_template_items_delete
  on public.plan_checklist_template_items for delete to authenticated
  using (public.can_edit_planning());
