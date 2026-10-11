-- BUG-086 probe: does daily_sheet_server_totals count a blank or padded payment
-- method as drawer cash, like drawerPaymentBucket() on the POS screen?
-- Rewrites one paid cash sale's method inside a transaction that always ends in
-- `raise exception`, so nothing is kept. Read the JSON in the message.

do $$
declare
  s record; base bigint; got jsonb := '{}'; m text;
begin
  select ds.id as sheet, sl.id as sale, sl.total_minor
    into s
  from public.daily_sheets ds
  join public.sales sl on sl.branch = ds.branch
   and sl.status = 'paid' and sl.payment_method = 'cash' and sl.total_minor > 0
   and (sl.occurred_at at time zone 'Asia/Manila')::date = ds.business_date
  order by ds.business_date desc limit 1;
  if s.sheet is null then raise exception 'PROBE fixtures missing'; end if;

  base := (public.daily_sheet_server_totals(s.sheet) ->> 'cashMinor')::bigint;
  foreach m in array array['', ' cash', 'CASH ', 'gcash'] loop
    update public.sales set payment_method = m where id = s.sale;
    got := got || jsonb_build_object(quote_literal(m),
      base - (public.daily_sheet_server_totals(s.sheet) ->> 'cashMinor')::bigint);
  end loop;

  -- Value = how much the drawer total dropped. Want 0 for every cash spelling,
  -- and the full sale for gcash (a wallet sale is not drawer cash).
  raise exception 'CASH_PROBE %', jsonb_build_object(
    'sale_minor', s.total_minor,
    'drop_by_method', got,
    'pass', (got ->> '''''')::bigint = 0 and (got ->> ''' cash''')::bigint = 0
            and (got ->> '''CASH ''')::bigint = 0 and (got ->> '''gcash''')::bigint = s.total_minor);
end $$;
