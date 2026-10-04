-- Floor Board / queue activity reads the latest events (order by created_at desc limit N).
create index if not exists queue_events_created_desc_idx on public.queue_events (created_at desc);
