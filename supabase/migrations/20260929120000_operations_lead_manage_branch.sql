-- Operations Lead runs the Queue network-wide (app: canAccessQueuePage /
-- canAddQueueService), but can_manage_branch left the role out, so RLS rejected
-- their bookings inserts/updates (add service, start, final check). The role has
-- no branch of its own, so it is allowed on any branch rather than through
-- user_has_branch_access. The other roles keep their branch check unchanged.
--
-- Also reached through can_manage_branch: bookings select/insert/update,
-- queue_assignments update, queue_events read/insert, staff_attendance
-- select/insert/update, can_view_queue_branch, can_edit_queue_branch.

begin;

create or replace function public.can_manage_branch(target_branch text)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select
    target_branch is not null
    and (
      (
        public.current_user_role() in ('admin', 'BossMich', 'assistant_super_admin', 'team_lead')
        and public.user_has_branch_access(target_branch)
      )
      or public.current_user_role() = 'operations_lead'
    );
$function$;

commit;
