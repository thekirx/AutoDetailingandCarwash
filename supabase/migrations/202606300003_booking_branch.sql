-- Add the service branch used by public booking and staff scheduling.

begin;

alter table public.bookings
add column if not exists branch text not null default 'bacoor';

alter table public.bookings
drop constraint if exists bookings_branch_check;

alter table public.bookings
add constraint bookings_branch_check
check (branch in ('bacoor', 'batangas'));

commit;
