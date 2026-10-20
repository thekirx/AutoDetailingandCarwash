-- Per-size branch stock for sellables. Empty size_key = unsized product (legacy rows).

begin;

alter table public.product_branch_stock
  add column if not exists size_key text not null default '';

alter table public.product_stock_movements
  add column if not exists size_key text not null default '';

comment on column public.product_branch_stock.size_key is
  'Lowercased size label from products.size_options. Empty string = unsized product.';

comment on column public.product_stock_movements.size_key is
  'Size key deducted or adjusted; empty for unsized products.';

alter table public.product_branch_stock
  drop constraint if exists product_branch_stock_product_id_branch_slug_key;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_branch_stock'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (product_id, branch_slug)'
  ) then
    execute (
      select 'alter table public.product_branch_stock drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'public.product_branch_stock'::regclass
        and contype = 'u'
        and pg_get_constraintdef(oid) = 'UNIQUE (product_id, branch_slug)'
      limit 1
    );
  end if;
end $$;

alter table public.product_branch_stock
  drop constraint if exists product_branch_stock_product_branch_size_key;

alter table public.product_branch_stock
  add constraint product_branch_stock_product_branch_size_key
  unique (product_id, branch_slug, size_key);

create index if not exists product_branch_stock_branch_product_size_idx
  on public.product_branch_stock (branch_slug, product_id, size_key);

-- POS deduct matches line size_label (lowercased) or '' when the product has no sizes.
do $patch$
declare
  def text;
  needle text :=
    'where pbs.product_id = prod_id
          and pbs.branch_slug = v_branch
          and pbs.qty >=';
  repl text :=
    'where pbs.product_id = prod_id
          and pbs.branch_slug = v_branch
          and pbs.size_key = lower(trim(coalesce(line->>''size_label'', '''')))
          and pbs.qty >=';
begin
  def := pg_get_functiondef('public.complete_pos_sale_impl(jsonb)'::regprocedure);

  if position('pbs.size_key' in def) > 0 then
    return;
  end if;

  if position('product_branch_stock' in def) = 0 then
    raise exception 'complete_pos_sale_impl has no product_branch_stock deduct; update this migration';
  end if;

  if position(needle in def) = 0 then
    raise exception 'complete_pos_sale_impl stock WHERE clause changed; update this migration';
  end if;

  def := replace(def, needle, repl);
  execute def;
end
$patch$;

commit;
