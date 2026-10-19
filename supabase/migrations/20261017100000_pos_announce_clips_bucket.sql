-- Private TTS clip cache for POS payment announcements.
-- Written/read only by the service-role server (/api/pos-announce).
-- No authenticated policies → browser clients cannot list or download clips.
-- Path: {provider}/{model}/{voice}/{sha256(text).slice(0,32)}.{mp3|wav}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pos-announce-clips',
  'pos-announce-clips',
  false,
  524288,
  array['audio/mpeg', 'audio/wav']
)
on conflict (id) do nothing;
