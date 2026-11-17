-- Blog & Events CMS database optimization:
-- 1. Least-privilege table grants (anon SELECT only; no TRUNCATE/TRIGGER/REFERENCES/write grants for anon)
-- 2. Covering updated_at DESC indexes for CMS Studio lists (top-100 reads without Seq Scan)
-- 3. Data integrity constraints & BEFORE INSERT OR UPDATE trigger keeping slug/title/status/is_published/updated_at synced
-- 4. Enable Realtime (supabase_realtime publication) on public.blogs and public.events
-- 5. Backfill structured editorial content_blocks on legacy empty published post toyota-innova-zenix-premium-ceramic-coating

BEGIN;

-- Normalize existing blog rows before enforcing constraints
UPDATE public.blogs
SET
  title = btrim(title),
  slug = COALESCE(
    NULLIF(trim(BOTH '-' FROM regexp_replace(lower(btrim(COALESCE(NULLIF(slug, ''), title))), '[^a-z0-9]+', '-', 'g')), ''),
    'post-' || left(id::text, 8)
  ),
  status = CASE
    WHEN status = 'archived' THEN 'archived'
    WHEN is_published IS TRUE OR status = 'published' THEN 'published'
    ELSE 'draft'
  END,
  is_published = CASE
    WHEN status = 'archived' THEN false
    ELSE (is_published IS TRUE OR status = 'published')
  END,
  published_at = CASE
    WHEN (status = 'published' OR is_published IS TRUE) AND status <> 'archived' THEN COALESCE(published_at, created_at, now())
    ELSE published_at
  END
WHERE
  title IS DISTINCT FROM btrim(title)
  OR slug IS DISTINCT FROM COALESCE(
    NULLIF(trim(BOTH '-' FROM regexp_replace(lower(btrim(COALESCE(NULLIF(slug, ''), title))), '[^a-z0-9]+', '-', 'g')), ''),
    'post-' || left(id::text, 8)
  )
  OR (status = 'published') IS DISTINCT FROM is_published
  OR ((status = 'published' OR is_published IS TRUE) AND status <> 'archived' AND published_at IS NULL);

-- Normalize existing event rows before enforcing constraints
UPDATE public.events
SET
  title = btrim(title),
  slug = COALESCE(
    NULLIF(trim(BOTH '-' FROM regexp_replace(lower(btrim(COALESCE(NULLIF(slug, ''), title))), '[^a-z0-9]+', '-', 'g')), ''),
    'event-' || left(id::text, 8)
  )
WHERE
  title IS DISTINCT FROM btrim(title)
  OR slug IS DISTINCT FROM COALESCE(
    NULLIF(trim(BOTH '-' FROM regexp_replace(lower(btrim(COALESCE(NULLIF(slug, ''), title))), '[^a-z0-9]+', '-', 'g')), ''),
    'event-' || left(id::text, 8)
  );

-- Backfill structured editorial blocks only if the Innova Zenix post is still empty
UPDATE public.blogs
SET
  excerpt = 'How our detailing crew prepped and locked in long-term ceramic protection on a daily-driven Toyota Innova Zenix.',
  content_blocks = jsonb_build_array(
    jsonb_build_object('id', 'iz-1', 'type', 'heading', 'level', 2, 'text', 'Full panel decontamination before the first drop of ceramic'),
    jsonb_build_object('id', 'iz-2', 'type', 'paragraph', 'text', 'Even brand-new MPVs pick up rail dust, water-spot etching, and dealer wash marring before turnover. On this Innova Zenix, every bay hour focused on leveling the clear coat first so the ceramic layer bonds directly to crisp factory paint.'),
    jsonb_build_object('id', 'iz-3', 'type', 'heading', 'level', 3, 'text', 'Step-by-step bay workflow'),
    jsonb_build_object('id', 'iz-4', 'type', 'list', 'ordered', false, 'items', jsonb_build_array(
      'pH-neutral snow foam, iron fallout removal, and fine-grade clay decontamination',
      'Single-stage gloss enhancement polish across hoods, sliding doors, and tailgates',
      'IPA panel wipe-down in temperature-checked bays prior to coating application',
      'Controlled cure check covering hydrophobic beading and trim uniform finish'
    )),
    jsonb_build_object('id', 'iz-5', 'type', 'quote', 'text', 'A glossy finish lasts years in Philippine rain and sun only when every bonded contaminant is stripped first.', 'cite', 'Hakum Auto Care Detailing Team'),
    jsonb_build_object('id', 'iz-6', 'type', 'cta', 'label', 'Book Ceramic Coating', 'url', '/book', 'style', 'primary')
  ),
  updated_at = now()
WHERE slug = 'toyota-innova-zenix-premium-ceramic-coating'
  AND jsonb_array_length(COALESCE(content_blocks, '[]'::jsonb)) = 0;

-- Least-privilege table grants on blogs & events
REVOKE ALL ON TABLE public.blogs FROM anon;
GRANT SELECT ON TABLE public.blogs TO anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.blogs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blogs TO authenticated;

REVOKE ALL ON TABLE public.events FROM anon;
GRANT SELECT ON TABLE public.events TO anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.events FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events TO authenticated;

-- Covering indexes for Content Studio top-N queries sorted by updated_at DESC
CREATE INDEX IF NOT EXISTS blogs_updated_at_idx
  ON public.blogs (updated_at DESC);

CREATE INDEX IF NOT EXISTS events_updated_at_idx
  ON public.events (updated_at DESC);

-- Data integrity check constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.blogs'::regclass AND conname = 'blogs_title_nonempty'
  ) THEN
    ALTER TABLE public.blogs
      ADD CONSTRAINT blogs_title_nonempty CHECK (length(btrim(title)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.blogs'::regclass AND conname = 'blogs_slug_nonempty'
  ) THEN
    ALTER TABLE public.blogs
      ADD CONSTRAINT blogs_slug_nonempty CHECK (length(btrim(slug)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.blogs'::regclass AND conname = 'blogs_status_published_sync'
  ) THEN
    ALTER TABLE public.blogs
      ADD CONSTRAINT blogs_status_published_sync CHECK ((status = 'published') = is_published);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass AND conname = 'events_title_nonempty'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_title_nonempty CHECK (length(btrim(title)) > 0);
  END IF;
END
$$;

-- Shared trigger function normalizing blogs & events rows on write
CREATE OR REPLACE FUNCTION public.sync_cms_content_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_prefix text;
  v_raw_slug text;
BEGIN
  NEW.title := btrim(COALESCE(NEW.title, ''));
  v_prefix := CASE WHEN TG_TABLE_NAME = 'events' THEN 'event-' ELSE 'post-' END;
  v_raw_slug := COALESCE(NULLIF(btrim(NEW.slug), ''), NEW.title);
  NEW.slug := NULLIF(trim(BOTH '-' FROM regexp_replace(lower(v_raw_slug), '[^a-z0-9]+', '-', 'g')), '');
  IF NEW.slug IS NULL THEN
    NEW.slug := v_prefix || left(COALESCE(NEW.id::text, gen_random_uuid()::text), 8);
  END IF;

  IF TG_TABLE_NAME = 'blogs' THEN
    IF TG_OP = 'UPDATE' AND (NEW.is_published IS DISTINCT FROM OLD.is_published) AND NEW.status = OLD.status THEN
      NEW.status := CASE WHEN NEW.is_published THEN 'published' ELSE 'draft' END;
    ELSIF NEW.status IS NULL OR NEW.status NOT IN ('draft', 'published', 'archived') THEN
      NEW.status := CASE WHEN COALESCE(NEW.is_published, false) THEN 'published' ELSE 'draft' END;
    END IF;
    NEW.is_published := (NEW.status = 'published');
    IF NEW.is_published AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  END IF;

  IF NEW.content_blocks IS NULL OR jsonb_typeof(NEW.content_blocks) <> 'array' THEN
    NEW.content_blocks := '[]'::jsonb;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := COALESCE(NEW.updated_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blogs_sync_cms_row ON public.blogs;
CREATE TRIGGER trg_blogs_sync_cms_row
  BEFORE INSERT OR UPDATE ON public.blogs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cms_content_row();

DROP TRIGGER IF EXISTS trg_events_sync_cms_row ON public.events;
CREATE TRIGGER trg_events_sync_cms_row
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cms_content_row();

-- Publish blogs and events to supabase_realtime so public/customer/admin listeners update in real time
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'blogs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.blogs;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
    END IF;
  END IF;
END
$$;

COMMIT;
