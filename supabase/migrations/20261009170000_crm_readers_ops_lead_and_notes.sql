-- CRM readers match canAccessCrm: Operations Lead joins as view only, and every CRM reader
-- (plus queue_all ASA, who sees notes in the ticket editor) can read guest notes.
-- Read-only: no insert/update/delete grants change here.

alter policy customers_select on public.customers using (
  (id = (select auth.uid()))
  or (public.current_user_role() = any (array['admin', 'team_lead', 'BossMich', 'marketing', 'sales', 'operations_lead']))
  or public.asa_has_grant('crm')
  or public.asa_has_grant('queue_all')
  or public.asa_has_grant('pos')
);

alter policy customer_notes_select on public.customer_notes using (
  archived_at is null
  and (
    public.is_staff()
    or public.is_super_admin()
    or public.current_user_role() = any (array['sales', 'operations_lead'])
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
  )
);

alter policy customer_memberships_select on public.customer_memberships using (
  public.is_super_admin()
  or public.asa_has_grant('memberships')
  or public.current_user_role() = any (array['admin', 'marketing', 'sales', 'operations_lead'])
);

alter policy "CRM read loyalty" on public.loyalty_ledger using (
  public.is_admin()
  or public.current_user_role() = any (array['marketing', 'sales', 'BossMich', 'operations_lead'])
);

-- Operations Lead is network-wide (can_manage_branch) but has no branch assignments,
-- so it needs its own clause to see who wrote a ticket note.
create or replace function public.staff_display_names(p_ids uuid[])
returns table(id uuid, full_name text, role text)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select sp.id, sp.full_name, sp.role::text
  from public.staff_profiles sp
  where auth.uid() is not null
    and sp.id = any(p_ids)
    and (
      public.current_user_role() = 'operations_lead'
      or public.user_has_branch_access(sp.branch_slug)
      or exists (
        select 1 from public.staff_branch_assignments a
        where a.staff_id = sp.id and public.user_has_branch_access(a.branch_slug)
      )
    );
$function$;

alter policy sales_select on public.sales using (
  (select public.is_super_admin())
  or (select public.asa_has_grant('finance_view'))
  or (
    (select public.current_user_role()) = any (array['admin', 'marketing', 'investor'])
    and branch = any ((select public.accessible_branch_slugs())::text[])
  )
  or (
    (select public.current_user_role()) = 'team_lead'
    and branch = (select public.current_user_branch())
  )
  or (select public.current_user_role()) = any (array['sales', 'cashier', 'operations_lead'])
);
