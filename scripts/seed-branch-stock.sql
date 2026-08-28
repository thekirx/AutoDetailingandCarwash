-- Ops cutover: seed resellable SKU stock per branch (POS fail-closed without rows).
-- Column is qty (not quantity). Safe to re-run.
INSERT INTO product_branch_stock (product_id, branch_slug, qty)
SELECT p.id, b.slug, 100
FROM products p
CROSS JOIN branches b
WHERE p.usage_kind = 'resellable'
ON CONFLICT (product_id, branch_slug) DO UPDATE
SET qty = EXCLUDED.qty, updated_at = now();
