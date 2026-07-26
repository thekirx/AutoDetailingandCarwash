-- Realtime for TL queue picker + Super Admin cars catalog live sync
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vehicle_catalog'
  ) then
    alter publication supabase_realtime add table public.vehicle_catalog;
  end if;
end $$;

-- Replica identity full so UPDATE payloads include old/new for clients (ponytail: fine at this table size)
alter table public.vehicle_catalog replica identity full;
