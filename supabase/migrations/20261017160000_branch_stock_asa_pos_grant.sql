-- ASA with the POS grant can assign branch stock, same as the inventory screen.

drop policy if exists product_branch_stock_insert on public.product_branch_stock;
create policy product_branch_stock_insert on public.product_branch_stock
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      public.is_assistant_super_admin()
      and (public.asa_has_grant('services_merch') or public.asa_has_grant('pos'))
    )
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
      and qty >= 0
    )
  );

drop policy if exists product_branch_stock_update on public.product_branch_stock;
create policy product_branch_stock_update on public.product_branch_stock
  for update to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_assistant_super_admin()
      and (public.asa_has_grant('services_merch') or public.asa_has_grant('pos'))
    )
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.is_assistant_super_admin()
      and (public.asa_has_grant('services_merch') or public.asa_has_grant('pos'))
    )
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
      and qty >= 0
    )
  );

drop policy if exists product_branch_stock_delete on public.product_branch_stock;
create policy product_branch_stock_delete on public.product_branch_stock
  for delete to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_assistant_super_admin()
      and (public.asa_has_grant('services_merch') or public.asa_has_grant('pos'))
    )
  );
