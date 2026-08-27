-- Owner Revisions P2: detailing completion_outcome + private booking-updates photos.

begin;

-- ---------------------------------------------------------------------------
-- bookings.completion_outcome — required in app when detailing → completed
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists completion_outcome text;

alter table public.bookings drop constraint if exists bookings_completion_outcome_check;
alter table public.bookings
  add constraint bookings_completion_outcome_check
  check (
    completion_outcome is null
    or completion_outcome = any (
      array['no_issues'::text, 'complaints_addressed'::text, 'unhappy'::text]
    )
  );

comment on column public.bookings.completion_outcome is
  'Detailing complete: no_issues | complaints_addressed | unhappy. Required when moving detailing-family bookings to completed.';

-- Seed Experience list on the primary planning board (create board if missing).
do $$
declare
  bid uuid;
  max_pos int;
begin
  select id into bid from public.plan_boards order by created_at asc nulls last limit 1;
  if bid is null then
    insert into public.plan_boards (name) values ('Hakum Planning') returning id into bid;
    insert into public.plan_lists (board_id, title, position) values
      (bid, 'Upcoming', 0),
      (bid, 'In Progress', 1),
      (bid, 'Done', 2),
      (bid, 'Experience', 3);
  elsif not exists (
    select 1 from public.plan_lists where board_id = bid and title = 'Experience'
  ) then
    select coalesce(max(position), -1) into max_pos from public.plan_lists where board_id = bid;
    insert into public.plan_lists (board_id, title, position)
    values (bid, 'Experience', max_pos + 1);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Private storage: booking-updates/{bookingId}/…
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-updates',
  'booking-updates',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

drop policy if exists booking_updates_select on storage.objects;
create policy booking_updates_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'booking-updates'
    and (
      public.is_admin()
      or public.is_super_admin()
      or public.current_user_role() = any (
        array[
          'sales'::text,
          'team_lead'::text,
          'operations_lead'::text,
          'assistant_super_admin'::text,
          'marketing'::text
        ]
      )
      or exists (
        select 1
        from public.bookings b
        where b.id::text = split_part(name, '/', 1)
          and b.customer_id = (select auth.uid())
      )
    )
  );

drop policy if exists booking_updates_insert on storage.objects;
create policy booking_updates_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'booking-updates'
    and (
      public.is_admin()
      or public.is_super_admin()
      or public.current_user_role() = any (
        array[
          'sales'::text,
          'team_lead'::text,
          'operations_lead'::text,
          'assistant_super_admin'::text
        ]
      )
    )
  );

drop policy if exists booking_updates_update on storage.objects;
create policy booking_updates_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'booking-updates'
    and (
      public.is_admin()
      or public.is_super_admin()
      or public.current_user_role() = any (
        array['sales'::text, 'team_lead'::text, 'operations_lead'::text, 'assistant_super_admin'::text]
      )
    )
  )
  with check (
    bucket_id = 'booking-updates'
    and (
      public.is_admin()
      or public.is_super_admin()
      or public.current_user_role() = any (
        array['sales'::text, 'team_lead'::text, 'operations_lead'::text, 'assistant_super_admin'::text]
      )
    )
  );

commit;
