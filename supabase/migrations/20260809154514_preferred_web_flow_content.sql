begin;

alter type public.profile_role add value if not exists 'content_marketing';

do $$
begin
  create type public.content_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'external'
    check (platform in ('facebook', 'instagram', 'external')),
  source_url text,
  title text not null,
  excerpt text,
  media_url text,
  cta_label text not null default 'View original post',
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.staff_profiles (id) on delete set null,
  updated_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_posts_published_at_check check (
    status <> 'published' or published_at is not null
  )
);

alter table public.events
  add column if not exists status public.content_status not null default 'draft',
  add column if not exists source_url text,
  add column if not exists platform text not null default 'external',
  add column if not exists cta_label text not null default 'Event details',
  add column if not exists location_text text,
  add column if not exists registration_url text,
  add column if not exists created_by uuid references public.staff_profiles (id) on delete set null,
  add column if not exists updated_by uuid references public.staff_profiles (id) on delete set null,
  add column if not exists published_at timestamptz;

alter table public.events
  drop constraint if exists events_platform_check;

alter table public.events
  add constraint events_platform_check
  check (platform in ('facebook', 'instagram', 'external'));

update public.events
set
  status = case when is_published then 'published'::public.content_status else 'draft'::public.content_status end,
  published_at = case when is_published then coalesce(published_at, created_at, now()) else published_at end;

create or replace function public.sync_event_content_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is null then
      new.status := case
        when coalesce(new.is_published, false) then 'published'::public.content_status
        else 'draft'::public.content_status
      end;
    end if;
    new.is_published := new.status = 'published'::public.content_status;
  elsif new.status is distinct from old.status then
    new.is_published := new.status = 'published'::public.content_status;
  elsif new.is_published is distinct from old.is_published then
    new.status := case
      when new.is_published then 'published'::public.content_status
      when old.status = 'archived'::public.content_status then 'archived'::public.content_status
      else 'draft'::public.content_status
    end;
  end if;

  if new.status = 'published'::public.content_status then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists events_sync_content_status on public.events;
create trigger events_sync_content_status
before insert or update of status, is_published on public.events
for each row execute function public.sync_event_content_status();

create or replace function public.stamp_managed_content()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  end if;
  if new.status = 'published'::public.content_status then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists social_posts_stamp_managed_content on public.social_posts;
create trigger social_posts_stamp_managed_content
before insert or update on public.social_posts
for each row execute function public.stamp_managed_content();

drop trigger if exists events_stamp_managed_content on public.events;
create trigger events_stamp_managed_content
before insert or update on public.events
for each row execute function public.stamp_managed_content();

create index if not exists social_posts_publication_idx
  on public.social_posts (status, published_at desc);
create index if not exists events_content_publication_idx
  on public.events (status, starts_at);

alter table public.social_posts enable row level security;

revoke all on table public.social_posts from anon, authenticated;
grant select on table public.social_posts to anon;
grant select, insert, update, delete on table public.social_posts to authenticated;
grant delete on table public.events to authenticated;

drop policy if exists "Public read published social posts" on public.social_posts;
create policy "Public read published social posts"
on public.social_posts
for select
to anon, authenticated
using (status = 'published'::public.content_status);

drop policy if exists "Content managers read all social posts" on public.social_posts;
create policy "Content managers read all social posts"
on public.social_posts
for select
to authenticated
using (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers insert social posts" on public.social_posts;
create policy "Content managers insert social posts"
on public.social_posts
for insert
to authenticated
with check (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers update social posts" on public.social_posts;
create policy "Content managers update social posts"
on public.social_posts
for update
to authenticated
using (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
)
with check (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers delete social posts" on public.social_posts;
create policy "Content managers delete social posts"
on public.social_posts
for delete
to authenticated
using (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers read all events" on public.events;
create policy "Content managers read all events"
on public.events
for select
to authenticated
using (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers insert events" on public.events;
create policy "Content managers insert events"
on public.events
for insert
to authenticated
with check (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers update events" on public.events;
create policy "Content managers update events"
on public.events
for update
to authenticated
using (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
)
with check (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers delete events" on public.events;
create policy "Content managers delete events"
on public.events
for delete
to authenticated
using (
  (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media',
  'content-media',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Content managers read content media" on storage.objects;
create policy "Content managers read content media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'content-media'
  and (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers upload content media" on storage.objects;
create policy "Content managers upload content media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'content-media'
  and (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers update content media" on storage.objects;
create policy "Content managers update content media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'content-media'
  and (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
)
with check (
  bucket_id = 'content-media'
  and (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

drop policy if exists "Content managers delete content media" on storage.objects;
create policy "Content managers delete content media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'content-media'
  and (select public.current_user_role()) = any (
    array['content_marketing'::text, 'BossMich'::text, 'assistant_super_admin'::text]
  )
);

commit;
