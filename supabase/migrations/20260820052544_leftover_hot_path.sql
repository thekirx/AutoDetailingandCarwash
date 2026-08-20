-- Leftover hot path: drop the racey MAX+1 queue trigger, stop unauthenticated stamp minting, and keep is_inquiry_reader off anon.

drop trigger if exists trg_assign_daily_queue_number on public.bookings;
drop function if exists public.assign_daily_queue_number();

revoke all on function public.award_loyalty_stamps(uuid, uuid, integer) from public, anon, authenticated;

revoke all on function public.is_inquiry_reader() from public, anon;
grant execute on function public.is_inquiry_reader() to authenticated;
