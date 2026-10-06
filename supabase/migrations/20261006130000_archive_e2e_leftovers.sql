-- Archive e2e leftovers that carry no money: E2E-script bookings (no sale, no transaction)
-- and the throwaway "E2E Customer …" rows. Rows tied to a sale or transaction
-- ("TestName", "test run") stay live for an owner decision. Reversible: flip is_archived.

begin;

update public.bookings b
set is_archived = true
where not coalesce(b.is_archived, false)
  and (
    coalesce(b.notes, '') ~* '^E2E real-customer '
    or b.customer_id in (select c.id from public.customers c where c.full_name ~* '^E2E Customer ')
  )
  and not exists (select 1 from public.sales s where s.booking_id = b.id)
  and not exists (select 1 from public.transactions t where t.booking_id = b.id);

update public.customers c
set is_archived = true
where not coalesce(c.is_archived, false)
  and c.full_name ~* '^E2E Customer '
  and not exists (select 1 from public.sales s where s.customer_id = c.id)
  and not exists (
    select 1 from public.bookings b where b.customer_id = c.id and not coalesce(b.is_archived, false)
  );

commit;
