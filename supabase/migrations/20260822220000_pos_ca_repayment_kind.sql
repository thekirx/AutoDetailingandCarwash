-- Add CA repayment expense kind to POS settings default list.

update public.ops_pos_settings
set expense_kinds = expense_kinds || '[{"value":"ca_repayment","label":"CA repayment (crew paid back)"}]'::jsonb
where id = 1
  and not expense_kinds::text like '%ca_repayment%';
