# Cars catalog

**Route:** `/operations/cars`  
**Roles:** Super Admin  
**Shell:** Command

## Purpose
Master make/model list for the floor and book pickers, with a PH bay size used to auto-price services and packages.

## Layout
```
[Add make / model / size]
[Search + size filter + visibility]
[Table: make, model, size, active]
[Edit modal]
```

## Size
`small` · `medium` · `large` · `extra_large` — same slugs as `service_size_prices` and `bookings.vehicle_type`.

Chart (bay footprint):
- **Small** — sedans, hatchbacks, city cars
- **Medium** — crossovers / compact CUVs, small MPVs
- **Large** — midsize+ SUVs, pickups, larger MPVs
- **Extra Large** — full-size vans, people movers, full-size SUVs

Picking a catalog model on queue, bookings, public/account book, CRM, or garage fills this size. Staff or the customer can still change it on the ticket. Wash, packages, and detailing prices follow the chosen size when the SKU has a size matrix.

## Data
`vehicle_catalog.size_slug` (not null). Seed: `scripts/seed-vehicle-catalog.mjs`. Infer helper: `src/lib/phVehicleSizes.js`.
