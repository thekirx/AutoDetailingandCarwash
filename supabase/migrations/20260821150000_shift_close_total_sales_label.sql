-- Rename Square sales → Total sales in shift close field config (storage key unchanged).
update public.shift_close_field_config
set label = 'Total sales'
where field_key = 'square_sales_minor'
  and label ilike '%square%';
