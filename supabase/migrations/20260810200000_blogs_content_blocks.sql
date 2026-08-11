-- Blogs CMS + rich content_blocks on events + public media bucket.
-- query-: index blogs by status/published_at and slug for public list/detail.
-- security-: public read published only; SA/ASA write via staff role checks.

alter table public.events
  add column if not exists content_blocks jsonb not null default '[]'::jsonb;

alter table public.events drop constraint if exists events_content_blocks_is_array;
alter table public.events
  add constraint events_content_blocks_is_array check (jsonb_typeof(content_blocks) = 'array');

create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  excerpt text,
  cover_url text,
  content_blocks jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  is_published boolean not null default false,
  published_at timestamptz,
  author_label text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blogs_content_blocks_is_array check (jsonb_typeof(content_blocks) = 'array'),
  constraint blogs_slug_unique unique (slug)
);

create index if not exists blogs_published_idx
  on public.blogs (published_at desc nulls last)
  where is_published = true and status = 'published';

create index if not exists blogs_status_idx on public.blogs (status, updated_at desc);

alter table public.blogs enable row level security;

drop policy if exists blogs_public_select on public.blogs;
create policy blogs_public_select on public.blogs
  for select to anon, authenticated
  using (is_published = true and status = 'published');

drop policy if exists blogs_staff_select on public.blogs;
create policy blogs_staff_select on public.blogs
  for select to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin', 'marketing')
    )
  );

drop policy if exists blogs_staff_write on public.blogs;
create policy blogs_staff_write on public.blogs
  for all to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  );

grant select on public.blogs to anon, authenticated;
grant insert, update, delete on public.blogs to authenticated;

-- Storage bucket for blog/event media (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media',
  'content-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists content_media_public_read on storage.objects;
create policy content_media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'content-media');

drop policy if exists content_media_staff_write on storage.objects;
create policy content_media_staff_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  );

drop policy if exists content_media_staff_update on storage.objects;
create policy content_media_staff_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  );

drop policy if exists content_media_staff_delete on storage.objects;
create policy content_media_staff_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content-media'
    and exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role in ('BossMich', 'assistant_super_admin')
    )
  );

-- Sample blog + event (idempotent by slug)
insert into public.blogs (
  title, slug, excerpt, cover_url, author_label, status, is_published, published_at, content_blocks
)
select
  'Ceramic coating that actually lasts in PH heat',
  'ceramic-coating-ph-heat',
  'How Hakum prep, cure, and aftercare keep gloss alive through monsoon humidity and parking-lot sun.',
  '/branding/hakum-lw-blue.png',
  'Hakum Auto Care',
  'published',
  true,
  now(),
  '[
    {"id":"b1","type":"heading","level":2,"text":"Heat, salt air, and daily wash cycles"},
    {"id":"b2","type":"paragraph","text":"Metro and coastal cars take a beating. Ceramic is not a magic spray. It is prep, product, and discipline. This is how we run it at Hakum."},
    {"id":"b3","type":"image","url":"/branding/hakum-mark-blue.png","alt":"Hakum mark","caption":"Detailing that starts with the panel, not the bottle."},
    {"id":"b4","type":"heading","level":3,"text":"What we do on every ceramic bay"},
    {"id":"b5","type":"list","ordered":false,"items":["Full decontamination wash and clay","Machine polish to level the clear","Panel wipe with IPA before coat","Controlled cure window before release"]},
    {"id":"b6","type":"quote","text":"If the paint is not ready, the coat fails early. We refuse short cuts on prep.","cite":"Hakum detailing lead"},
    {"id":"b7","type":"paragraph","text":"Book a ceramic consult at either branch. Bring the car dirty. We would rather see real condition than a showroom wipe."},
    {"id":"b8","type":"cta","label":"Book a visit","url":"/book","style":"primary"}
  ]'::jsonb
where not exists (select 1 from public.blogs where slug = 'ceramic-coating-ph-heat');

-- Enrich sample event if missing content blocks
do $$
declare
  eid uuid;
  form_uuid uuid;
begin
  select id into form_uuid from public.ops_forms where slug = 'events-rsvp' limit 1;

  select id into eid from public.events where slug = 'hakum-saturday-meet' limit 1;
  if eid is null then
    insert into public.events (
      title, slug, description, branch, starts_at, ends_at, is_published, form_id, banner_url, content_blocks
    ) values (
      'Hakum Saturday Meet',
      'hakum-saturday-meet',
      'Cars, coffee, and bay tours. Bring your weekend driver.',
      'bacoor',
      (date_trunc('week', now()) + interval '5 days' + interval '9 hours'),
      (date_trunc('week', now()) + interval '5 days' + interval '12 hours'),
      true,
      form_uuid,
      '/branding/hakum-lw-ow.png',
      jsonb_build_array(
        jsonb_build_object('id','e1','type','heading','level',2,'text','Morning meet at Bacoor'),
        jsonb_build_object('id','e2','type','paragraph','text','Park, talk shop, and walk the detailing floor. Crew will demo ceramic wipe-down and answer PPF fitment questions.'),
        jsonb_build_object('id','e3','type','image','url','/branding/hakum-lw-blue.png','alt','Hakum Auto Care','caption','Bacoor branch courtyard'),
        jsonb_build_object('id','e4','type','video','url','https://www.youtube.com/watch?v=dQw4w9WgXcQ','provider','youtube','caption','Optional walkthrough clip'),
        jsonb_build_object('id','e5','type','list','ordered',true,'items',jsonb_build_array('09:00 gates open','09:30 bay tour','10:30 Q&A with leads')),
        jsonb_build_object(
          'id','e6','type','cta','label','RSVP on form','style','primary',
          'form_id', coalesce(form_uuid::text, ''),
          'url', case when form_uuid is not null then '/f/events-rsvp' else '/events' end
        ),
        jsonb_build_object('id','e7','type','paragraph','text','Spots are limited. Use the RSVP form so we can plan parking.')
      )
    );
  else
    update public.events
    set
      form_id = coalesce(form_id, form_uuid),
      content_blocks = case
        when content_blocks is null or jsonb_array_length(content_blocks) = 0 then
          jsonb_build_array(
            jsonb_build_object('id','e1','type','heading','level',2,'text','Morning meet at Bacoor'),
            jsonb_build_object('id','e2','type','paragraph','text','Park, talk shop, and walk the detailing floor.'),
            jsonb_build_object(
              'id','e6','type','cta','label','RSVP on form','style','primary',
              'form_id', coalesce(form_uuid::text, ''),
              'url', '/f/events-rsvp'
            )
          )
        else content_blocks
      end,
      is_published = true
    where id = eid;
  end if;
end $$;
