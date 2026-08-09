begin;

do $$
declare
  social_posts_rls boolean;
  content_role_exists boolean;
  required_event_columns integer;
  content_policy_count integer;
begin
  select c.relrowsecurity
  into social_posts_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'social_posts';

  if social_posts_rls is distinct from true then
    raise exception 'VERIFY: social_posts RLS is not enabled';
  end if;

  select exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'profile_role' and e.enumlabel = 'content_marketing'
  ) into content_role_exists;

  if not content_role_exists then
    raise exception 'VERIFY: content_marketing role is missing';
  end if;

  select count(*)
  into required_event_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'events'
    and column_name = any (array[
      'status', 'source_url', 'platform', 'cta_label', 'location_text',
      'registration_url', 'created_by', 'updated_by', 'published_at'
    ]);

  if required_event_columns <> 9 then
    raise exception 'VERIFY: expected 9 managed Events columns, found %', required_event_columns;
  end if;

  select count(*)
  into content_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('social_posts', 'events')
    and policyname ilike 'Content managers%';

  if content_policy_count < 8 then
    raise exception 'VERIFY: expected content management policies, found %', content_policy_count;
  end if;

  if not exists (select 1 from storage.buckets where id = 'content-media' and public) then
    raise exception 'VERIFY: public content-media bucket is missing';
  end if;
end $$;

insert into public.social_posts (
  id, title, status, published_at
)
values
  ('10000000-0000-0000-0000-000000000001', 'Visible post', 'published', now()),
  ('10000000-0000-0000-0000-000000000002', 'Draft post', 'draft', null);

set local role anon;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count
  from public.social_posts
  where id in (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  );

  if visible_count <> 1 then
    raise exception 'VERIFY: anon expected one published post, found %', visible_count;
  end if;
end $$;

reset role;

insert into public.staff_profiles (id, full_name, role)
values (
  '20000000-0000-0000-0000-000000000001',
  'Content Verification User',
  'content_marketing'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

insert into public.social_posts (id, title, status)
values ('20000000-0000-0000-0000-000000000002', 'Managed draft', 'draft');

update public.social_posts
set status = 'published'
where id = '20000000-0000-0000-0000-000000000002';

do $$
declare
  managed_count integer;
  unrelated_write_blocked boolean := false;
begin
  select count(*) into managed_count
  from public.social_posts
  where id = '20000000-0000-0000-0000-000000000002'
    and status = 'published'
    and published_at is not null;

  if managed_count <> 1 then
    raise exception 'VERIFY: content_marketing could not manage a Post';
  end if;

  begin
    insert into public.bookings (note) values ('must be denied');
  exception
    when insufficient_privilege then unrelated_write_blocked := true;
  end;

  if not unrelated_write_blocked then
    raise exception 'VERIFY: content_marketing unexpectedly wrote an unrelated booking';
  end if;
end $$;

insert into public.events (
  id, title, starts_at, status
)
values (
  '20000000-0000-0000-0000-000000000003',
  'Managed event',
  now() + interval '7 days',
  'published'
);

do $$
begin
  if not exists (
    select 1 from public.events
    where id = '20000000-0000-0000-0000-000000000003'
      and status = 'published'
      and is_published
      and published_at is not null
  ) then
    raise exception 'VERIFY: content_marketing could not manage an Event';
  end if;
end $$;

delete from public.events
where id = '20000000-0000-0000-0000-000000000003';

delete from public.social_posts
where id = '20000000-0000-0000-0000-000000000002';

reset role;

rollback;
