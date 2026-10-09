-- Sales sees the whole Queue (all branches) but may only write detailing-board bookings.
-- Mirrors isBookingBoardService (src/lib/serviceKinds.js): floor detailing slug or pay_category 'detailing'.
-- Wash / package / general / addon bookings stay view-only for Sales at the database too.

drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings
  for insert to authenticated
  with check (
    can_manage_branch(branch)
    or (
      current_user_role() = 'sales'
      and status::text = any (array['pending', 'confirmed'])
      and exists (
        select 1 from public.services s
        where s.id = bookings.service_id
          and (
            coalesce(s.pay_category, '') = 'detailing'
            or s.slug = any (array['ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint', 'paint-protection-film'])
          )
      )
    )
  );

drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings
  for update to authenticated
  using (
    can_manage_branch(branch)
    or (
      current_user_role() = 'sales'
      and status::text = any (array['pending', 'confirmed', 'waiting', 'in_progress', 'final_checking', 'for_releasing', 'for_payment', 'completed', 'cancelled'])
      and exists (
        select 1 from public.services s
        where s.id = bookings.service_id
          and (
            coalesce(s.pay_category, '') = 'detailing'
            or s.slug = any (array['ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint', 'paint-protection-film'])
          )
      )
    )
    or (
      current_user_role() = 'detailer'
      and user_has_branch_access(branch)
      and exists (
        select 1 from public.services s
        where s.id = bookings.service_id
          and coalesce(s.pay_category, '') = any (array['detailing', 'ppf'])
      )
    )
  )
  with check (
    can_manage_branch(branch)
    or (
      current_user_role() = 'sales'
      and status::text = any (array['pending', 'confirmed', 'waiting', 'in_progress', 'final_checking', 'for_releasing', 'for_payment', 'completed', 'cancelled'])
      and exists (
        select 1 from public.services s
        where s.id = bookings.service_id
          and (
            coalesce(s.pay_category, '') = 'detailing'
            or s.slug = any (array['ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint', 'paint-protection-film'])
          )
      )
    )
    or (
      current_user_role() = 'detailer'
      and user_has_branch_access(branch)
      and exists (
        select 1 from public.services s
        where s.id = bookings.service_id
          and coalesce(s.pay_category, '') = any (array['detailing', 'ppf'])
      )
    )
  );
