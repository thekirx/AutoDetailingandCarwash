-- Harden services catalog constraints (schema integrity at trust boundary).
-- Clean violating rows FIRST, then add CHECKs (query / schema best practice).

-- 1) Fix blank / invalid catalog rows left from smokes or bad inserts
update public.services
set
  name = case
    when length(trim(coalesce(name, ''))) = 0 then 'Untitled service'
    else trim(name)
  end,
  slug = case
    when length(trim(coalesce(slug, ''))) = 0 then 'service-' || substr(replace(id::text, '-', ''), 1, 8)
    else trim(slug)
  end,
  price_minor = case
    when price_minor is null or price_minor < 0 then 0
    else price_minor
  end,
  duration_minutes = case
    when duration_minutes is null or duration_minutes <= 0 then 30
    else duration_minutes
  end,
  updated_at = clock_timestamp()
where length(trim(coalesce(name, ''))) = 0
   or length(trim(coalesce(slug, ''))) = 0
   or price_minor is null
   or price_minor < 0
   or duration_minutes is null
   or duration_minutes <= 0;

-- 2) Add constraints only after data is clean
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_name_not_blank'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_name_not_blank check (length(trim(name)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'services_price_nonneg'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_price_nonneg check (price_minor >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'services_duration_positive'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_duration_positive check (duration_minutes > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'services_slug_not_blank'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_slug_not_blank check (length(trim(slug)) > 0);
  end if;
end $$;
