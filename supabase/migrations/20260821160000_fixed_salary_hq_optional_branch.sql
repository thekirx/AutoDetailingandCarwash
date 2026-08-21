-- Fixed salary is company-wide (no bay required). Books still post under HQ branch.

insert into public.branches (slug, name, code, is_active, is_archived, coming_soon)
values ('hq', 'Hakum HQ / Office', 'HQ', true, false, false)
on conflict (slug) do update
set name = excluded.name,
    code = excluded.code,
    is_active = true,
    is_archived = false;

alter table public.staff_pay_packages
  alter column branch drop not null;
