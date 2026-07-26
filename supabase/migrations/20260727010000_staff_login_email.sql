-- Crew login email cache for pool CRUD display (auth email remains source of truth on update).
alter table public.staff_profiles
  add column if not exists login_email text;

create index if not exists staff_profiles_login_email_lower_idx
  on public.staff_profiles (lower(login_email));
