-- Supervisor graph for People directory (TL reports to Operations Lead, etc.).
alter table public.staff_profiles
  add column if not exists is_supervisor boolean not null default false;

alter table public.staff_profiles
  add column if not exists reports_to uuid references public.staff_profiles(id) on delete set null;

create index if not exists staff_profiles_reports_to_idx
  on public.staff_profiles (reports_to)
  where reports_to is not null;
