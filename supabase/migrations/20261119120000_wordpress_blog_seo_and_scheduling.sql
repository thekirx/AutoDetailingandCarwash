-- =============================================================================
-- WordPress-style Blog Taxonomies, SEO Overrides, Scheduled Publishing & RLS
-- =============================================================================
-- 1. First-class taxonomy & SEO columns on public.blogs (category, region, tags,
--    seo_title, seo_description, seo_keywords, ai_summary, canonical_url,
--    og_image_url, noindex, is_featured, read_minutes).
-- 2. Expand status constraint to ('draft', 'scheduled', 'published', 'archived')
--    and update sync_cms_content_row() trigger accordingly.
-- 3. Narrow public & non-editor authenticated SELECT RLS so scheduled or
--    future-dated posts stay hidden until published_at <= now().
-- 4. Backfill taxonomy/SEO columns from content_blocks[0].post_meta and add
--    GIN / category / region indexes for scalable WordPress archives.

begin;

do $$
begin
  if to_regclass('public.blogs') is null then
    raise exception 'public.blogs table must exist before upgrading blog SEO & scheduling schema';
  end if;
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'can_manage_site_content'
  ) then
    raise exception 'public.can_manage_site_content() is missing — apply content CMS RBAC migration first';
  end if;
end
$$;

alter table public.blogs
  add column if not exists category text not null default 'Regional Authority Guide',
  add column if not exists region text not null default 'all',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text,
  add column if not exists ai_summary text,
  add column if not exists canonical_url text,
  add column if not exists og_image_url text,
  add column if not exists noindex boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists read_minutes integer not null default 4;

alter table public.blogs drop constraint if exists blogs_status_check;
alter table public.blogs
  add constraint blogs_status_check check (status in ('draft', 'scheduled', 'published', 'archived'));

alter table public.blogs drop constraint if exists blogs_read_minutes_positive;
alter table public.blogs
  add constraint blogs_read_minutes_positive check (read_minutes >= 1 and read_minutes <= 240);

-- Keep trigger compatible with 'scheduled' while keeping is_published synced for 'published'.
create or replace function public.sync_cms_content_row()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_prefix text;
  v_raw_slug text;
begin
  NEW.title := btrim(coalesce(NEW.title, ''));
  v_prefix := case when TG_TABLE_NAME = 'events' then 'event-' else 'post-' end;
  v_raw_slug := coalesce(nullif(btrim(NEW.slug), ''), NEW.title);
  NEW.slug := nullif(trim(both '-' from regexp_replace(lower(v_raw_slug), '[^a-z0-9]+', '-', 'g')), '');
  if NEW.slug is null then
    NEW.slug := v_prefix || left(coalesce(NEW.id::text, gen_random_uuid()::text), 8);
  end if;

  if TG_TABLE_NAME = 'blogs' then
    if TG_OP = 'UPDATE' and (NEW.is_published is distinct from OLD.is_published) and NEW.status = OLD.status then
      NEW.status := case when NEW.is_published then 'published' else 'draft' end;
    elsif NEW.status is null or NEW.status not in ('draft', 'scheduled', 'published', 'archived') then
      NEW.status := case when coalesce(NEW.is_published, false) then 'published' else 'draft' end;
    end if;

    NEW.is_published := (NEW.status = 'published');
    if NEW.status = 'published' and NEW.published_at is null then
      NEW.published_at := now();
    end if;
  end if;

  if NEW.content_blocks is null or jsonb_typeof(NEW.content_blocks) <> 'array' then
    NEW.content_blocks := '[]'::jsonb;
  end if;

  if TG_OP = 'UPDATE' then
    NEW.updated_at := now();
  else
    NEW.updated_at := coalesce(NEW.updated_at, now());
  end if;

  return NEW;
end;
$$;

-- Backfill first-class columns from content_blocks[0].post_meta without overwriting newer values.
update public.blogs b
set
  category = coalesce(nullif(btrim(b.content_blocks->0->'post_meta'->>'category'), ''), b.category, 'Regional Authority Guide'),
  region = coalesce(nullif(btrim(b.content_blocks->0->'post_meta'->>'region'), ''), b.region, 'all'),
  ai_summary = coalesce(nullif(btrim(b.content_blocks->0->'post_meta'->>'ai_summary'), ''), b.ai_summary),
  seo_title = coalesce(nullif(btrim(b.content_blocks->0->'post_meta'->>'seo_title'), ''), b.seo_title),
  seo_description = coalesce(nullif(btrim(b.content_blocks->0->'post_meta'->>'seo_description'), ''), b.seo_description),
  seo_keywords = coalesce(nullif(btrim(b.content_blocks->0->'post_meta'->>'seo_keywords'), ''), b.seo_keywords),
  canonical_url = coalesce(nullif(btrim(b.content_blocks->0->'post_meta'->>'canonical_url'), ''), b.canonical_url),
  og_image_url = coalesce(nullif(btrim(b.content_blocks->0->'post_meta'->>'og_image_url'), ''), b.og_image_url),
  is_featured = coalesce((b.content_blocks->0->'post_meta'->>'is_featured')::boolean, (b.content_blocks->0->'post_meta'->>'featured')::boolean, b.is_featured),
  read_minutes = greatest(1, least(240, coalesce(nullif(b.content_blocks->0->'post_meta'->>'read_minutes', '')::integer, b.read_minutes, 4))),
  tags = case
    when jsonb_typeof(b.content_blocks->0->'post_meta'->'tags') = 'array' then
      coalesce(
        array(
          select distinct nullif(lower(btrim(t)), '')
          from jsonb_array_elements_text(b.content_blocks->0->'post_meta'->'tags') as t
          where nullif(btrim(t), '') is not null
        ),
        b.tags
      )
    else b.tags
  end
where jsonb_typeof(b.content_blocks->0->'post_meta') = 'object';

-- Narrow public & non-editor RLS to respect scheduled publication timestamps cleanly.
drop policy if exists blogs_public_select on public.blogs;
create policy blogs_public_select on public.blogs
  for select to anon
  using (
    (status = 'published' and is_published = true and (published_at is null or published_at <= now()))
    or (status = 'scheduled' and published_at is not null and published_at <= now())
  );

drop policy if exists blogs_select_authenticated on public.blogs;
create policy blogs_select_authenticated on public.blogs
  for select to authenticated
  using (
    (status = 'published' and is_published = true and (published_at is null or published_at <= now()))
    or (status = 'scheduled' and published_at is not null and published_at <= now())
    or public.can_manage_site_content()
  );

-- Supporting archive & tag lookup indexes
create index if not exists blogs_tags_gin_idx on public.blogs using gin (tags);
create index if not exists blogs_category_idx on public.blogs (category, published_at desc nulls last);
create index if not exists blogs_region_idx on public.blogs (region, published_at desc nulls last);

commit;
