-- Align shift_close_field_config with SHIFT_CLOSE_MONEY_KEYS (GCash, cash left, CA, etc.)
-- Existing rows keep allow_override; new keys default overrideable.

insert into public.shift_close_field_config (field_key, label, allow_override, sort_order, is_active) values
  ('downpayments_minor', 'Downpayments', true, 15, true),
  ('ca_collected_minor', 'CA collected', true, 25, true),
  ('queue_app_sales_minor', 'Queue app sales', true, 55, true)
on conflict (field_key) do update
  set label = excluded.label,
      is_active = true;

-- Ensure cash-left / GCash / expenses stay active + overrideable (idempotent)
update public.shift_close_field_config
set allow_override = true,
    is_active = true
where field_key in (
  'total_gcash_minor',
  'total_cash_left_minor',
  'credit_card_minor',
  'total_expenses_minor',
  'ca_collected_minor',
  'square_sales_minor'
);
