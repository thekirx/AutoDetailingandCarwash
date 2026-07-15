begin;

alter function public.start_assignments_on_booking_progress()
  security definer;

alter function public.start_assignments_on_booking_progress()
  set search_path = pg_catalog, public;

revoke all on function public.start_assignments_on_booking_progress()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
