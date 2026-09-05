-- "Hakum HQ / Office" was appearing in the public branch list, the homepage
-- location line and the footer, because the only thing separating a branch
-- from a back-office location was is_active — and HQ is genuinely active.
--
-- Rather than deactivate a real location (which would misrepresent it to
-- operations), branches gain an explicit flag for whether customers should be
-- shown them. HQ keeps every operational property it has; it just stops being
-- advertised as somewhere to bring a car.

alter table public.branches
  add column if not exists is_public boolean not null default true;

comment on column public.branches.is_public is
  'Whether this location is shown to customers. False for back-office sites '
  'such as HQ, which are operationally real but are not service branches.';

update public.branches
set is_public = false
where slug = 'hq';
