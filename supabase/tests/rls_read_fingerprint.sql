-- Read-only RLS visibility fingerprint for the hot daily-flow tables.
-- Impersonates every active staff user (plus 6 customers with bookings) and hashes the row ids each one can
-- SELECT from sales / sale_line_items / bookings / queue_events. Run before and after a policy rewrite:
-- `fingerprint` must be identical. Nothing is written outside a temp table.
-- Over the MCP execute_sql timeout, run it in user chunks (append `offset N limit 5` to the population query).
create temp table if not exists rls_fp (uid uuid, role text, t text, n bigint, h text) on commit drop;
truncate rls_fp;

do $$
declare
  r record;
  n_sales bigint; h_sales text;
  n_lines bigint; h_lines text;
  n_bookings bigint; h_bookings text;
  n_events bigint; h_events text;
begin
  for r in
    select * from (
      select id, role::text as role from public.staff_profiles
      where coalesce(is_active, false) and not coalesce(is_archived, false)
      union all
      (select distinct b.customer_id, 'customer' from public.bookings b
       where b.customer_id is not null and not exists (select 1 from public.staff_profiles sp where sp.id = b.customer_id)
       order by 1 limit 6)
    ) population order by id
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', r.id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) into n_sales, h_sales from public.sales;
    select count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) into n_lines, h_lines from public.sale_line_items;
    select count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) into n_bookings, h_bookings from public.bookings;
    select count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) into n_events, h_events from public.queue_events;
    reset role;
    insert into rls_fp values
      (r.id, r.role, 'sales', n_sales, h_sales),
      (r.id, r.role, 'sale_line_items', n_lines, h_lines),
      (r.id, r.role, 'bookings', n_bookings, h_bookings),
      (r.id, r.role, 'queue_events', n_events, h_events);
  end loop;
end $$;

select
  (select md5(string_agg(uid::text || t || n || h, '|' order by uid, t)) from rls_fp) as fingerprint,
  (select count(distinct uid) from rls_fp) as users,
  (select json_object_agg(role || ':' || t, rows) from (
     select role, t, json_agg(distinct n order by n) as rows from rls_fp group by role, t
   ) s) as visible_rows_by_role;
