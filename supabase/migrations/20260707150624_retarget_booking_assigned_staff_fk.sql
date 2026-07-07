update public.bookings b
set assigned_staff_id = null
where assigned_staff_id is not null
  and not exists (
    select 1
    from public.staff_profiles sp
    where sp.id = b.assigned_staff_id
  );

alter table public.bookings
drop constraint if exists bookings_assigned_staff_id_fkey;

alter table public.bookings
add constraint bookings_assigned_staff_id_fkey
foreign key (assigned_staff_id) references public.staff_profiles(id) on delete set null;

notify pgrst, 'reload schema';
