-- Sales: full detailing board pipeline (service/price edits + status via API).
-- Status transitions for Sales go through /api/booking-status (service role);
-- RLS must allow Sales to update booking rows across the 6 board statuses.

begin;

drop policy if exists "Sales can update form bookings" on public.bookings;
create policy "Sales can update form bookings"
on public.bookings
for update
to authenticated
using (
  public.current_user_role() = 'sales'
  and public.user_has_branch_access(branch)
  and status::text in (
    'pending',
    'confirmed',
    'waiting',
    'in_progress',
    'final_checking',
    'completed',
    'cancelled'
  )
)
with check (
  public.current_user_role() = 'sales'
  and public.user_has_branch_access(branch)
  and status::text in (
    'pending',
    'confirmed',
    'waiting',
    'in_progress',
    'final_checking',
    'completed',
    'cancelled'
  )
);

commit;
