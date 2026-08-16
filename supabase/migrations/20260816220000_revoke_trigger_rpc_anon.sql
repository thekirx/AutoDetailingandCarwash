-- Trigger-only helpers must not be callable as PostgREST RPCs.
-- Recreated SECURITY DEFINER helpers sometimes regain PUBLIC/anon EXECUTE.

revoke execute on function public.guard_plan_card_assignee_self_update() from public, anon;
revoke execute on function public.trg_assign_booking_queue_number() from public, anon;

revoke execute on function public.current_user_branch_slugs() from public, anon;
revoke execute on function public.user_has_branch_access(text) from public, anon;
grant execute on function public.current_user_branch_slugs() to authenticated;
grant execute on function public.user_has_branch_access(text) to authenticated;

notify pgrst, 'reload schema';
