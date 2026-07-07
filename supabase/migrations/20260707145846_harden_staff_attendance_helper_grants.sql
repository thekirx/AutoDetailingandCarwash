revoke execute on function public.current_user_role() from anon;
revoke execute on function public.current_user_branch_slug() from anon;
revoke execute on function public.can_view_queue_branch(text) from anon;
revoke execute on function public.can_edit_queue_branch(text) from anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_branch_slug() to authenticated;
grant execute on function public.can_view_queue_branch(text) to authenticated;
grant execute on function public.can_edit_queue_branch(text) to authenticated;

notify pgrst, 'reload schema';
