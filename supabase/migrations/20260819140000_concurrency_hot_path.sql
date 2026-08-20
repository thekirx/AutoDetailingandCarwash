-- Concurrent floor/POS: indexes for settle + live payment lane, payroll RLS once-per-query, archive e2e leftovers.

-- Archive probe tickets (names/plates are e2e). Keep ceramic paint-maintenance seed CRM1101 on the floor.
update public.bookings
set is_archived = true, updated_at = clock_timestamp()
where coalesce(is_archived, false) = false
  and status::text in ('waiting', 'in_progress', 'final_checking', 'for_payment')
  and (
    vehicle_plate in ('TES8080', 'SLSE2E')
    or customer_name = 'E2E Sales Route Probe'
  );

create index if not exists transactions_pos_handoff_idx
  on public.transactions (pos_handoff_id)
  where pos_handoff_id is not null;

create index if not exists bookings_for_payment_floor_idx
  on public.bookings (branch, created_at desc)
  where coalesce(is_archived, false) = false
    and status = 'for_payment';

create index if not exists sale_line_items_product_id_idx
  on public.sale_line_items (product_id)
  where product_id is not null;

create index if not exists expense_status_events_expense_id_idx
  on public.expense_status_events (expense_id);

create index if not exists loyalty_ledger_sale_id_idx
  on public.loyalty_ledger (sale_id)
  where sale_id is not null;

drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs
for select to authenticated
using (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_view')
  )
  or exists (
    select 1 from public.payroll_run_lines l
    where l.run_id = payroll_runs.id
      and l.staff_id = (select auth.uid())
  )
);

drop policy if exists payroll_run_lines_select on public.payroll_run_lines;
create policy payroll_run_lines_select on public.payroll_run_lines
for select to authenticated
using (
  staff_id = (select auth.uid())
  or public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_view')
  )
);

drop policy if exists payroll_run_sales_select on public.payroll_run_sales;
create policy payroll_run_sales_select on public.payroll_run_sales
for select to authenticated
using (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_view')
  )
  or exists (
    select 1 from public.payroll_run_lines l
    where l.run_id = payroll_run_sales.run_id
      and l.staff_id = (select auth.uid())
  )
);

revoke execute on function public.sync_queue_assignments(uuid, uuid[]) from anon, public;
grant execute on function public.sync_queue_assignments(uuid, uuid[]) to authenticated;

revoke execute on function public.trg_assign_booking_queue_number() from public, anon, authenticated;
revoke execute on function public.guard_plan_card_assignee_self_update() from public, anon, authenticated;
revoke execute on function public.archive_instead_of_delete() from public, anon, authenticated;

notify pgrst, 'reload schema';
