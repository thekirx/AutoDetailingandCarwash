-- Option B (wizard form template, approved 17 Oct 2026):
-- allow a 'custom' kind so admins can create general-purpose forms in Planner → Forms.
-- Widens the kind constraint and mirrors staff permissions; no rows change. Kirk applies this by hand.

begin;

alter table public.ops_forms drop constraint if exists ops_forms_kind_check;
alter table public.ops_forms
  add constraint ops_forms_kind_check
  check (kind in (
    'complaint',
    'event',
    'equipment_repair',
    'cash_advance',
    'detailing',
    'custom'
  ));

-- Staff fill + read of published forms goes through can_submit_ops_form(kind)
-- (ops_forms_select and ops_form_submissions_insert policies). Give 'custom'
-- the same roles as 'detailing'; every other branch is copied unchanged from
-- 20261009150000_planner_rls_match_app.sql.
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
    when 'custom' then public.current_user_role() in
      ('BossMich', 'assistant_super_admin', 'admin', 'operations_lead', 'staff', 'team_lead', 'marketing', 'video_editor')
    else false
  end;
$$;

revoke all on function public.can_submit_ops_form(text) from public, anon;
grant execute on function public.can_submit_ops_form(text) to authenticated;

commit;
