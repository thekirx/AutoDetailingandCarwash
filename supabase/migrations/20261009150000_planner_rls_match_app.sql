-- Planner RLS now matches the app rules in src/auth/permissions.js.
-- 1. canEditPlanning includes the Operations Lead; the DB helper did not, so the Planner was empty for them.
-- 2. canSubmitOpsFormKind lets crew / TL / marketing / video file some forms; the DB only let editors
--    read forms or insert submissions, so "Fill a form" never appeared for them.

create or replace function public.can_edit_planning()
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select
    public.is_super_admin()
    or public.current_user_role() in ('admin', 'operations_lead')
    or public.asa_has_grant('planning_edit');
$$;

-- Mirror of canSubmitOpsFormKind(profile, kind).
create or replace function public.can_submit_ops_form(p_kind text)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select case p_kind
    when 'equipment_repair' then public.current_user_role() = 'staff'
    when 'cash_advance' then public.current_user_role() in
      ('staff', 'detailer', 'team_lead', 'operations_lead', 'admin', 'assistant_super_admin')
    when 'complaint' then public.current_user_role() in
      ('BossMich', 'assistant_super_admin', 'admin', 'operations_lead', 'staff', 'team_lead', 'marketing', 'video_editor')
    when 'event' then public.current_user_role() in
      ('BossMich', 'assistant_super_admin', 'admin', 'operations_lead', 'staff', 'team_lead', 'marketing', 'video_editor')
    when 'detailing' then public.current_user_role() in
      ('BossMich', 'assistant_super_admin', 'admin', 'operations_lead', 'staff', 'team_lead', 'marketing', 'video_editor')
    else false
  end;
$$;

revoke all on function public.can_submit_ops_form(text) from public, anon;
grant execute on function public.can_submit_ops_form(text) to authenticated;

drop policy if exists ops_forms_select on public.ops_forms;
create policy ops_forms_select
  on public.ops_forms for select to authenticated
  using (
    public.can_edit_planning()
    or public.is_admin()
    or (status = 'published' and is_active and public.can_submit_ops_form(kind))
  );

alter table public.ops_form_submissions alter column created_by set default auth.uid();

drop policy if exists ops_form_submissions_insert on public.ops_form_submissions;
create policy ops_form_submissions_insert
  on public.ops_form_submissions for insert to authenticated
  with check (
    public.can_edit_planning()
    or (
      created_by = (select auth.uid())
      and source = 'staff'
      and status = 'new'
      and plan_card_id is null
      and exists (
        select 1 from public.ops_forms f
        where f.id = form_id
          and f.status = 'published'
          and f.is_active
          and public.can_submit_ops_form(f.kind)
      )
    )
  );

drop policy if exists ops_form_submissions_select on public.ops_form_submissions;
create policy ops_form_submissions_select
  on public.ops_form_submissions for select to authenticated
  using (
    public.can_edit_planning()
    or public.is_admin()
    or created_by = (select auth.uid())
  );
