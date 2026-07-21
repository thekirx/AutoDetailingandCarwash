-- Fix Super Admin / ops 403s caused by crew KPI migration revoking grants without re-grant.
-- Root cause: 20260715153235 revoked SELECT on crew_kpi_summary and EXECUTE on
-- normalize_plate_number (+ related helpers) from authenticated.

grant select on public.crew_kpi_summary to authenticated;

grant select on public.operations_queue_board to authenticated;
grant select on public.available_staff_view to authenticated;
grant select on public.busy_staff_view to authenticated;
grant select on public.pos_ready_tickets to authenticated;
grant select on public.active_customer_queue to authenticated;
grant select on public.customer_vehicle_masterlist to authenticated;

-- Re-grant queue helpers revoked in harden_related_functions
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'normalize_plate_number',
        'assign_daily_queue_number',
        'link_booking_to_masterlist',
        'log_queue_status_change',
        'create_completion_sms_event',
        'archive_instead_of_delete'
      )
  loop
    execute format('grant execute on function %s to authenticated', fn.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';
