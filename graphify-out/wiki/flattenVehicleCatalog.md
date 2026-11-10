# flattenVehicleCatalog

> 14 nodes · cohesion 0.14

## Key Concepts

- **flattenVehicleCatalog()** (12 connections) — `src/lib/phVehicles.js`
- **seed-vehicle-catalog.mjs** (7 connections) — `scripts/seed-vehicle-catalog.mjs`
- **gen-vehicle-catalog-size-sql.mjs** (5 connections) — `scripts/gen-vehicle-catalog-size-sql.mjs`
- **gen-vehicle-catalog-sql.mjs** (5 connections) — `scripts/gen-vehicle-catalog-sql.mjs`
- **split-size-updates.mjs** (5 connections) — `scripts/split-size-updates.mjs`
- **rows** (1 connections) — `scripts/gen-vehicle-catalog-size-sql.mjs`
- **vals** (1 connections) — `scripts/gen-vehicle-catalog-size-sql.mjs`
- **rows** (1 connections) — `scripts/gen-vehicle-catalog-sql.mjs`
- **vals** (1 connections) — `scripts/gen-vehicle-catalog-sql.mjs`
- **admin** (1 connections) — `scripts/seed-vehicle-catalog.mjs`
- **loadEnv()** (1 connections) — `scripts/seed-vehicle-catalog.mjs`
- **rows** (1 connections) — `scripts/seed-vehicle-catalog.mjs`
- **chunkSize** (1 connections) — `scripts/split-size-updates.mjs`
- **rows** (1 connections) — `scripts/split-size-updates.mjs`

## Relationships

- [phVehicles.js](phVehicles.js.md) (6 shared connections)
- [ref_node_assert](ref_node_assert.md) (4 shared connections)
- [apply-size-diff-from-dump.mjs](apply-size-diff-from-dump.mjs.md) (2 shared connections)
- [@supabase/supabase-js](@supabase-supabase-js.md) (1 shared connections)
- [customerPortal.mjs](customerPortal.mjs.md) (1 shared connections)
- [gen-vehicle-size-resync.mjs](gen-vehicle-size-resync.mjs.md) (1 shared connections)
- [verify-vehicle-catalog-parity.mjs](verify-vehicle-catalog-parity.mjs.md) (1 shared connections)
- [phVehicleSizes.js](phVehicleSizes.js.md) (1 shared connections)

## Source Files

- `scripts/gen-vehicle-catalog-size-sql.mjs`
- `scripts/gen-vehicle-catalog-sql.mjs`
- `scripts/seed-vehicle-catalog.mjs`
- `scripts/split-size-updates.mjs`
- `src/lib/phVehicles.js`

## Audit Trail

- EXTRACTED: 30 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*