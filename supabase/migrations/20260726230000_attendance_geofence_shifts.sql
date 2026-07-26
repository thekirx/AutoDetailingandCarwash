-- Full attendance: geofence + shifts + geo check-in metadata + realtime

alter table public.branches
  add column if not exists geofence_radius_m integer not null default 150,
  add column if not exists shift_start time not null default '08:00',
  add column if not exists shift_end time not null default '18:00';

alter table public.branches
  drop constraint if exists branches_geofence_radius_m_check;
alter table public.branches
  add constraint branches_geofence_radius_m_check check (geofence_radius_m between 30 and 5000);

alter table public.staff_attendance
  add column if not exists check_in_lat double precision,
  add column if not exists check_in_lng double precision,
  add column if not exists check_out_lat double precision,
  add column if not exists check_out_lng double precision,
  add column if not exists source text not null default 'manual',
  add column if not exists notes text;

alter table public.staff_attendance drop constraint if exists staff_attendance_status_check;
alter table public.staff_attendance
  add constraint staff_attendance_status_check
  check (status = any (array['present'::text, 'absent'::text, 'late'::text]));

alter table public.staff_attendance drop constraint if exists staff_attendance_source_check;
alter table public.staff_attendance
  add constraint staff_attendance_source_check
  check (source = any (array['geo'::text, 'manual'::text, 'admin'::text]));

create index if not exists staff_attendance_branch_date_idx
  on public.staff_attendance (branch_slug, attendance_date desc);

create index if not exists staff_attendance_staff_date_idx
  on public.staff_attendance (staff_id, attendance_date desc);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_attendance'
  ) then
    alter publication supabase_realtime add table public.staff_attendance;
  end if;
end $$;

alter table public.staff_attendance replica identity full;
