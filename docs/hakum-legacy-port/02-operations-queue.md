# 02 — Operations: Car Queue Lifecycle

Source: `QueueContext.tsx`, `QueueManager.tsx`, `QueueList.tsx`, `QueueItem.tsx`, `AddCarForm.tsx`, `EditCarForm.tsx`, `CancellationModal.tsx`, `validation.ts`.

## Status machine

```
waiting
  |  Start Service / assign crew / add as in-progress
  v
in-progress
  |  Ready for Payment
  v
payment-pending
  |  Mark Completed
  v
completed

Also:
- waiting | in-progress | payment-pending  -->  cancelled (reason required)
- in-progress | payment-pending  -->  waiting (clears crew)
```

### Allowed quick actions (`QueueItem.getValidActions`)

| Current status | Allowed next actions |
|----------------|----------------------|
| `waiting` | `in-progress`, `cancelled` |
| `in-progress` | `payment-pending`, `waiting`, `cancelled` |
| `payment-pending` | `completed`, `waiting`, `cancelled` |
| `completed` / `cancelled` | (no quick actions; completed not editable) |

Edit form exposes the full status dropdown for non-completed cars.

## Add car

**UI:** `AddCarForm` → `QueueContext.addCar` → insert `cars`.

### Defaults

- Status selectable at add: **Waiting** or **In Progress** only.
- Plate: trim + uppercase.
- `services`: `[...serviceIds, ...packageIds]`.
- `service`: comma-joined **names** for display/SMS.
- `total_cost`: calculated from size pricing, or manual override.
- `time_in_progress` set only if final status is `in-progress`.
- `time_waiting` often **not** set on create; UI falls back to `created_at`.

### Forced demotion to waiting

If user selects `in-progress` but:

1. Selected crew member is **busy today**, or
2. No crew and **no package**,

then force `status = waiting` and clear crew.

### Duplicate plate rule

Reject add if same plate already exists with status in:

`waiting` | `in-progress` | `payment-pending`

### History autofill

If plate matches an existing car (both sides of `-` present), `searchCarHistory` can fill model / phone / size.

### SMS on add

If `phone` non-empty → `POST /api/send-sms` with status + optional `queueNumber` when waiting. See [06-busybee-integration.md](./06-busybee-integration.md).

## Start service (waiting → in-progress)

1. User taps Start Service.
2. If vehicle has a **package ID** in `services` → jump straight to `in-progress` (no crew UI).
3. Else → crew picker → `handleAssignCrew`.
4. Assigning ≥1 crew while `waiting` **auto-promotes** to `in-progress` and SMS.

### Crew requirement (`validateCrewForStatus`)

- `in-progress` **requires** ≥1 crew **unless** a package is selected.
- Package detection: any ID in `services` that exists in `service_packages` (`hasPackageForVehicle`).
- Type field `requiresCrew` on packages is **unused** — do not rely on it; use “has package ID” rule (or implement `requiresCrew` properly in the new app).

## Status transitions and side effects

| Transition | Function path | Side effects |
|------------|---------------|--------------|
| → `in-progress` | quick action / assign crew / add | Set `time_in_progress` if missing; SMS |
| → `payment-pending` | quick action | SMS; client often **does not** set `time_ready_for_payment` |
| → `waiting` | quick action / edit | **Clear `crew = []`**; may set `time_waiting`; SMS |
| → `completed` | quick action | Set `completed_at`; SMS; completion update retries ×3 in UI |
| → `cancelled` | CancellationModal | Require reason; **no SMS** |

## Cancellation

- Modal: `CancellationModal`
- Reason required, **3–500** characters
- Presets:
  - Customer can't wait any longer
  - Customer doesn't want the service anymore
  - Customer needs to be somewhere
  - Others
- Persist: `status: 'cancelled'`, `cancellation_reason`, `updated_at`

## Soft delete

`removeCar` sets `is_deleted: true`. Fetches always filter `is_deleted = false`.

**UI gap:** delete handlers exist on `QueueItem` but **no button is wired**. Port soft delete if product wants it; or hard-delete with audit in the new system.

## Edit car

- Opened from queue card when `status !== 'completed'`.
- Completed cars: edit submit disabled.
- Validates plate, model, phone, size, status, cost (≥ 1 on edit).
- Busy crew excludes the current car’s own assignments.
- Relies on `updateCar` to clear crew when status becomes waiting.

## Filters, sort, daily total (`QueueList`)

### Defaults

- `statusFilter = 'waiting'`
- `dateFilter = 'today'`

### Date axis

Use `completed_at` if status is completed, else `created_at`. Compare at local noon.

| `dateFilter` | Behavior |
|--------------|----------|
| `today` | Same calendar day |
| `all` | No date filter |
| `custom` | Single day or `{ start, end }` range |

(Types file lists yesterday/month; QueueList UI uses today/all/custom.)

### Stats on date slice

Counts: waiting, in-progress, payment-pending, completed, cancelled.

**Daily total** = sum of `total_cost` for **completed** vehicles in the date filter.

### Search

Plate, model, `service` string, phone.

### Sort

- Waiting: oldest `created_at` first
- Completed: newest `updated_at` first

### Queue number

When status filter is waiting, display `index + 1` as queue position (used in SMS as well).

### History panel

Plate substring search across loaded vehicles, **ignores** date filter.

## Validation rules (cars)

| Field | Rule |
|-------|------|
| Plate | Required; trim/upper; 3–8 chars; **exactly one `-`** with both sides non-empty |
| Phone | Optional; if set: `^(09\|\+639)\d{9}$` after stripping spaces |
| Model | 2–100 chars; block script-like patterns |
| Cost | Number; ≥ 0; ≤ 100000 (edit also requires ≥ 1) |
| Size | `small` \| `medium` \| `large` \| `extra_large` |
| Status | One of five statuses |
| Cancel reason | 3–500 chars |

## Timestamp display rules (`QueueItem`)

- Waiting duration: `time_waiting || created_at` → now (or next timestamp)
- In-progress duration: `time_in_progress` → `time_ready_for_payment` or now
- Payment process: ends at completion / now

**Port fix recommended:** always set `time_ready_for_payment` when entering `payment-pending`.

## Multi-device reality

`QueueContext` loads data once on mount. `subscriptionsRef` is unused. There is **no** `supabase.channel` subscription.

For a scalable new app: add realtime (or short polling) on the team-lead queue and display boards.
