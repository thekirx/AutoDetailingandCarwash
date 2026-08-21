-- Branch-scope staff pay packages (future-branch ready).

alter table public.staff_pay_packages
  add column if not exists branch text references public.branches(slug) on update cascade on delete restrict;

update public.staff_pay_packages p
set branch = coalesce(
  (select sp.branch_slug from public.staff_profiles sp where sp.id = p.staff_id),
  (select b.slug from public.branches b where b.is_active and not b.is_archived order by b.name limit 1)
)
where p.branch is null;

alter table public.staff_pay_packages
  alter column branch set not null;

create index if not exists staff_pay_packages_branch_staff_idx
  on public.staff_pay_packages (branch, staff_id)
  where is_active;
