-- Multi-branch ops forms + detailing-agnostic compensation keys + EoS field labels.
-- query-missing-indexes: unique on detailing:/ceramic: expense keys.
-- security-rls: no policy change; catalog data only.

-- 1) Expand ceramic expense unique index to also cover detailing: keys
drop index if exists public.expenses_ceramic_sale_uidx;
create unique index if not exists expenses_detailing_sale_uidx
  on public.expenses (description)
  where description like 'ceramic:%' or description like 'detailing:%';

-- 2) Sync ops_forms branch select options from live branches table
do $$
declare
  slugs text[];
  form_row record;
  next_fields jsonb;
  i int;
  field jsonb;
  opts jsonb;
begin
  select coalesce(array_agg(b.slug order by b.name), '{}'::text[])
  into slugs
  from public.branches b
  where coalesce(b.is_archived, false) = false
    and coalesce(b.is_active, true) = true;

  if array_length(slugs, 1) is null then
    return;
  end if;

  opts := to_jsonb(slugs);

  for form_row in
    select f.id as form_id, f.fields as form_fields
    from public.ops_forms f
    where f.kind in ('complaint', 'equipment_repair', 'cash_advance')
  loop
    next_fields := coalesce(form_row.form_fields, '[]'::jsonb);
    if jsonb_typeof(next_fields) <> 'array' then
      continue;
    end if;
    for i in 0 .. jsonb_array_length(next_fields) - 1 loop
      field := next_fields -> i;
      if (field ->> 'key') = 'branch' and (field ->> 'type') = 'select' then
        next_fields := jsonb_set(next_fields, array[i::text, 'options'], opts, true);
      end if;
    end loop;
    update public.ops_forms
    set fields = next_fields, updated_at = now()
    where id = form_row.form_id;
  end loop;
end $$;

-- 3) EoS field config: neutral labels + paint/detailing breakdown rows
update public.shift_close_field_config
set label = 'Coating sales'
where field_key = 'ceramic_coating_sales_minor';

update public.shift_close_field_config
set label = 'Tint sales'
where field_key = 'ceramic_tint_sales_minor';

insert into public.shift_close_field_config (field_key, label, allow_override, sort_order)
values
  ('paint_maintenance_sales_minor', 'Paint maintenance', true, 75),
  ('detailing_sales_minor', 'Other detailing', true, 78)
on conflict (field_key) do update
set label = excluded.label,
    allow_override = true;
