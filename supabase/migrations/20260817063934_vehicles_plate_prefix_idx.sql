-- Prefix typeahead: LIKE 'ABC%' on active garage plates (query-missing-indexes + text_pattern_ops).

create index if not exists vehicles_active_normalized_plate_prefix_idx
  on public.vehicles (normalized_plate_number text_pattern_ops)
  where coalesce(is_archived, false) = false;

analyze public.vehicles;
