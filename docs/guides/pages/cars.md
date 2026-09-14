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

Picking a catalog model on queue, bookings, public/account book, CRM, or garage fills this size. Staff or the customer can still change it on the ticket.

## Data
`vehicle_catalog.size_slug` (not null). Seed: `scripts/seed-vehicle-catalog.mjs`. Infer helper: `src/lib/phVehicleSizes.js`.
