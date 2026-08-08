# 03 — Services & Packages (Cars)

Source: `ServicesPage.tsx`, `AddCarForm.tsx`, `EditCarForm.tsx`, `QueueContext.tsx`, `src/types/index.ts`.

## Concepts

| Entity | Purpose |
|--------|---------|
| **Service** | Single billable line item with optional per-size pricing |
| **Package** | Bundle of service IDs with per-size pricing; treated as one selection |

On a car job:

- `services: string[]` holds **IDs** of selected services **and/or** packages.
- `service: string` holds comma-joined **human names** for UI badges and SMS `serviceType`.

## Size pricing

Car sizes: `small` | `medium` | `large` | `extra_large`.

```ts
interface SizePricing {
  small: number;
  medium: number;
  large: number;
  extra_large: number;
}
```

### Price resolution (add/edit forms)

For each selected service:

```
price = service.pricing[selectedSize] || service.price
```

For each selected package:

```
price = package.pricing[selectedSize] || 0
```

`total_cost` = sum of those prices (unless staff overrides manually on add).

## Service record

| Field | Notes |
|-------|-------|
| `id` | UUID |
| `name` | Required |
| `price` | Legacy scalar; ServicesPage sets this to `pricing.medium` on save |
| `pricing` | Preferred size map |
| `description` | Optional |
| `vehicle_type` | `'car'` \| `'motorcycle'` in legacy |
| `is_deleted` | Soft delete |

**Port bug to fix:** `handleServiceSubmit` in legacy often **does not send** `vehicle_type: 'car'` on create. Packages do set it. In a cars-only app, either omit `vehicle_type` or always set `'car'`.

## Package record

| Field | Notes |
|-------|-------|
| `id` | UUID |
| `name` | Required |
| `description` | Optional |
| `service_ids` | Non-empty array of service UUIDs |
| `pricing` | Required `SizePricing` |
| `is_active` | Must be true to appear in queue forms |
| `vehicle_type` | Set to `'car'` on create in ServicesPage |
| `requiresCrew` | Present in TypeScript types — **never set or enforced in UI** |
| `is_deleted` | Soft delete |

### Operational meaning of a package

If any selected ID is a package:

1. Crew is **not required** for `in-progress`.
2. Start Service skips the crew picker.
3. Toggling a package on in Add form **clears crew**.

Implement this in the new app even if you also add a first-class `requiresCrew` flag later.

## Catalog CRUD (team-lead surface)

Route: `/services` → `ServicesPage` (Layout).

| Action | Behavior |
|--------|----------|
| Add/edit service | Name required; store full size pricing; `price = medium` |
| Delete service | Soft: `is_deleted = true` |
| Add/edit package | ≥1 `service_ids`; `vehicle_type: 'car'`; `is_active: true` |
| Delete package | Soft delete |

Fetch rules (`QueueContext`):

- Services: `is_deleted = false` (and filter `vehicle_type === 'car'` in UI)
- Packages: `is_active` and `is_deleted = false`

## Filtering in forms

Add/Edit car forms only list catalog rows where `vehicle_type === 'car'` (when the field is present).

## What to copy into the new app

1. Size-based pricing map (4 sizes).
2. Dual representation: IDs on the job + display names string (or derive names at SMS time — preferred).
3. Package skips crew requirement.
4. Soft-delete for catalog rows (or equivalent archive).
5. Cars-only: drop motorcycle vehicle_type branching.

## What not to copy

- Motorcycle services page / package edit routes
- Dead `requiresCrew` without wiring (either implement it or omit the field)
- Assuming service create always tagged `vehicle_type` (legacy is inconsistent)
