-- Sales role: form-appointment bookings only (pending/confirmed/cancelled).
-- Do NOT add sales to can_manage_branch — that would unlock queue RPCs.

begin;

drop policy if exists "Sales can read branch bookings" on public.bookings;
create policy "Sales can read branch bookings"
on public.bookings
for select
to authenticated
using (
  public.current_user_role() = 'sales'
  and public.user_has_branch_access(branch)
);

drop policy if exists "Sales can insert form bookings" on public.bookings;
create policy "Sales can insert form bookings"
on public.bookings
for insert
to authenticated
with check (
  public.current_user_role() = 'sales'
  and public.user_has_branch_access(branch)
  and status::text in ('pending', 'confirmed')
);

drop policy if exists "Sales can update form bookings" on public.bookings;
create policy "Sales can update form bookings"
on public.bookings
for update
to authenticated
using (
  public.current_user_role() = 'sales'
  and public.user_has_branch_access(branch)
  and status::text in ('pending', 'confirmed', 'cancelled')
)
with check (
  public.current_user_role() = 'sales'
  and public.user_has_branch_access(branch)
  and status::text in ('pending', 'confirmed', 'cancelled')
);

commit;
