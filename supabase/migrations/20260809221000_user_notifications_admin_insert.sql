-- Allow ops admins to create in-app notifications (planner assign, etc.)

drop policy if exists "Admins insert notifications" on public.user_notifications;
create policy "Admins insert notifications" on public.user_notifications
for insert to authenticated
with check (public.is_admin());

grant insert on public.user_notifications to authenticated;
