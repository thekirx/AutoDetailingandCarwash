-- Coffee drinks are sold on their own. Cups, beans, and other coffee stock
-- are inventory counts only. A latte does not deduct grams or cups.

drop trigger if exists product_stock_movements_coffee_recipe on public.product_stock_movements;
drop function if exists public.apply_coffee_recipe();

update public.products
   set material_role = null
 where material_role is not null;
