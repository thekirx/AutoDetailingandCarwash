-- Leftover gate: complaints inbox UPDATE for SA/ASA, and stop clients calling the atomic queue allocator as an RPC.

drop policy if exists "Super admins update complaints" on public.complaints;
create policy "Super admins update complaints" on public.complaints
  for update to authenticated
  using (public.is_inquiry_reader())
  with check (public.is_inquiry_reader());

revoke all on function public.assign_daily_queue_number(text, date) from public, anon, authenticated;
