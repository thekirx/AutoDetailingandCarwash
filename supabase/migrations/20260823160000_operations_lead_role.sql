-- Add Operations Lead to profile_role (must commit before using the label).
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'profile_role' and e.enumlabel = 'operations_lead'
  ) then
    alter type public.profile_role add value 'operations_lead';
  end if;
end $$;
