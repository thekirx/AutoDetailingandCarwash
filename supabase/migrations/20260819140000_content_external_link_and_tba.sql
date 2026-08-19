-- Homepage content support:
--   1. blogs.external_url  — when set, "Read post" opens this URL instead of the
--      internal /blog/:slug route (e.g. an Instagram post).
--   2. events.is_date_tba  — events.starts_at is NOT NULL, so a date is always
--      stored; this flag tells the UI to show "To be announced" instead of it.
-- Both are additive with safe defaults; existing rows and behaviour are unchanged.

alter table public.blogs
  add column if not exists external_url text;

alter table public.events
  add column if not exists is_date_tba boolean not null default false;

comment on column public.blogs.external_url is
  'Optional external permalink (e.g. Instagram). When present the public card links here.';
comment on column public.events.is_date_tba is
  'When true the public card shows "To be announced" instead of starts_at.';
