-- Future-branch hygiene: give Dasmariñas a stable URL slug, move orphan rows off the
-- random audit slug, and archive leftover CRUD-test branches so People / Branches
-- pickers stay production-clean. No live Bacoor/Batangas money rows are touched.

begin;

-- Free DAS code on the random audit slug so the canonical row can own it
update public.branches set code = 'DAX' where slug = 'aud-xmyz95' and code = 'DAS';

-- 1) Canonical coming-soon row (idempotent)
insert into public.branches (
  slug, name, address, code, is_active, coming_soon, is_public, is_archived,
  latitude, longitude, geofence_radius_m, shift_start, shift_end, opens_at, closes_at, closed_weekdays,
  created_by, updated_by
)
select
  'dasmarinas',
  'Hakum Auto Care Dasmariñas',
  coalesce(b.address, 'Dasmariñas, Cavite'),
  'DAS',
  false,
  true,
  true,
  false,
  b.latitude,
  b.longitude,
  b.geofence_radius_m,
  b.shift_start,
  b.shift_end,
  b.opens_at,
  b.closes_at,
  coalesce(b.closed_weekdays, '{}'::int[]),
  b.created_by,
  b.updated_by
from public.branches b
where b.slug = 'aud-xmyz95'
  and not exists (select 1 from public.branches x where x.slug = 'dasmarinas');

-- If dasmarinas already exists, keep it coming-soon / public / not archived
update public.branches
set
  name = 'Hakum Auto Care Dasmariñas',
  code = 'DAS',
  coming_soon = true,
  is_active = false,
  is_public = true,
  is_archived = false,
  updated_at = now()
where slug = 'dasmarinas';

-- 2) Remap child rows from the random audit slug → dasmarinas
update public.bookings set branch = 'dasmarinas' where branch = 'aud-xmyz95';
update public.sales set branch = 'dasmarinas' where branch = 'aud-xmyz95';
update public.queue_events set branch = 'dasmarinas' where branch = 'aud-xmyz95';
update public.expenses set branch = 'dasmarinas' where branch = 'aud-xmyz95';
update public.staff_attendance set branch_slug = 'dasmarinas' where branch_slug = 'aud-xmyz95';
update public.staff_profiles set branch_slug = 'dasmarinas' where branch_slug = 'aud-xmyz95';
update public.staff_branch_assignments set branch_slug = 'dasmarinas' where branch_slug = 'aud-xmyz95';
update public.vehicles set first_branch = 'dasmarinas' where first_branch = 'aud-xmyz95';
update public.vehicles set last_branch = 'dasmarinas' where last_branch = 'aud-xmyz95';
update public.complaints set branch = 'dasmarinas' where branch = 'aud-xmyz95';
update public.events set branch = 'dasmarinas' where branch = 'aud-xmyz95';
update public.daily_sheets set branch = 'dasmarinas' where branch = 'aud-xmyz95';
update public.pos_handoffs set branch = 'dasmarinas' where branch = 'aud-xmyz95';
update public.product_branch_stock set branch_slug = 'dasmarinas' where branch_slug = 'aud-xmyz95';
update public.branch_operating_hours set branch_slug = 'dasmarinas' where branch_slug = 'aud-xmyz95'
  and not exists (
    select 1 from public.branch_operating_hours h
    where h.branch_slug = 'dasmarinas' and h.day_of_week = branch_operating_hours.day_of_week
  );
delete from public.branch_operating_hours where branch_slug = 'aud-xmyz95';

-- 3) Archive the random slug + CRUD probe junk (no bookings/sales on crudtest-*)
update public.branches
set
  is_archived = true,
  is_active = false,
  coming_soon = false,
  is_public = false,
  archived_at = coalesce(archived_at, now()),
  updated_at = now()
where slug = 'aud-xmyz95'
   or slug like 'crudtest-%'
   or slug like 'probe-%';

commit;
