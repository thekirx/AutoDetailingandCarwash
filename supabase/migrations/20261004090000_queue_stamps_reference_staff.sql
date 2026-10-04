-- Final check / sent-to-payment stamps are staff, not customers.
-- The legacy FKs pointed at public.customers, so any staff member without a customers row (TL Batangas, Site Admin,
-- BossMich, ASA) failed "Move to Final check" (client writes final_checked_by = staff id → FK violation), and
-- send_queue_ticket_to_payment silently stamped NULL for them (it looked the caller up in customers).

alter table public.bookings drop constraint if exists bookings_final_checked_by_fkey;
alter table public.bookings drop constraint if exists bookings_sent_to_payment_by_fkey;

alter table public.bookings
  add constraint bookings_final_checked_by_fkey foreign key (final_checked_by) references public.staff_profiles (id) on delete set null,
  add constraint bookings_sent_to_payment_by_fkey foreign key (sent_to_payment_by) references public.staff_profiles (id) on delete set null;

-- Stamp the caller's staff id in send_queue_ticket_to_payment (only these two assignments change).
do $$
declare
  def text;
  patched text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'send_queue_ticket_to_payment';
  if def is null then
    raise exception 'send_queue_ticket_to_payment not found';
  end if;
  patched := replace(def, 'final_checked_by = coalesce(b.final_checked_by, caller_customer_id)', 'final_checked_by = coalesce(b.final_checked_by, caller_id)');
  patched := replace(patched, 'sent_to_payment_by = coalesce(b.sent_to_payment_by, caller_customer_id)', 'sent_to_payment_by = coalesce(b.sent_to_payment_by, caller_id)');
  if patched = def or patched like '%sent_to_payment_by = coalesce(b.sent_to_payment_by, caller_customer_id)%' then
    raise exception 'send_queue_ticket_to_payment stamps not found — patch by hand';
  end if;
  execute patched;
end $$;
