-- Add Imus as a coming-soon branch, set up the same way as Dasmariñas:
-- public on the website, not open yet (no live queue, no sales), not archived.
-- Idempotent: re-running keeps the row coming-soon.

begin;

insert into public.branches (slug, name, address, code, is_active, coming_soon, is_public, is_archived)
select 'imus', 'Hakum Auto Care Imus', 'Imus, Cavite', 'IMU', false, true, true, false
where not exists (select 1 from public.branches where slug = 'imus');

update public.branches
set
  name = 'Hakum Auto Care Imus',
  coming_soon = true,
  is_active = false,
  is_public = true,
  is_archived = false,
  updated_at = now()
where slug = 'imus';

commit;
