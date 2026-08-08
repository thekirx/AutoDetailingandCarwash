# 09 — Autofill, Daily Behavior, History & Totals

**Cars only.** Motorcycle autofill / history must be **removed** in the new app (`searchMotorcycleHistory`, MC forms, MC toggle).

---

## 1. Plate autofill (Add Car)

Source: `AddCarForm.tsx`, `QueueContext.searchCarHistory`.

### Trigger

1. User types a plate.
2. Effect waits **500ms** debounce after `formData.plate` changes.
3. Autofill only proceeds if **both** gates pass.

### Gate A — plate shape

- Plate string must contain `-`
- Both sides of the dash must be non-empty (e.g. `ABC-1234`)

If plate has **no** dash:

- Clear `model`
- Clear `phone`
- Reset `size` to `'medium'`
- Clear “autofilled” UI flag

### Gate B — already in loaded queue memory

Exact match in in-memory `cars`:

```
c.plate.trim().toUpperCase() === plateInput.trim().toUpperCase()
```

If no local match → **no** `searchCarHistory` call (autofill never runs for plates only in DB but not loaded… actually wait - they need local match first THEN call DB. So returning customer must appear in loaded `cars` which is all non-deleted cars. Soft-deleted plates won't autofill.)

### DB lookup — `searchCarHistory(plate)`

| Rule | Behavior |
|------|----------|
| Match | Exact `plate` after `toUpperCase().trim()` |
| Filter | `is_deleted = false` |
| Order | Newest `created_at` first |
| Limit | 1 row (`.single()`) |
| Not found (`PGRST116`) | Return `null` (not an error) |
| Other errors | Log; return `null` |

### Fields filled (only these)

| Field | From history |
|-------|----------------|
| `model` | yes |
| `phone` | yes (or `''`) |
| `size` | yes |
| services / packages | **no** |
| crew | **no** |
| total_cost / status | **no** |

### UI

- Spinner while searching
- Green banner: model / phone / size were auto-filled
- History errors are **silent** (console only)

### Port rules

1. Keep debounce ~500ms.
2. Prefer: call history API when plate has dash (even without local match) — legacy gate B is overly strict; improving is OK if documented.
3. Never autofill motorcycle history in the new app.

---

## 2. Vehicle History panel (Queue list)

Source: `QueueList.tsx` — separate from Add-form autofill and from main search.

| Rule | Behavior |
|------|----------|
| Scope | Client-side on **currently loaded** cars only |
| Match | Partial: `plate.toLowerCase().includes(historySearch)` |
| Date filter | **Ignored** — searches all loaded days |
| Sort | Newest `created_at` first |
| Empty | `"No history found for this plate number"` |
| Shows | plate, model, status, date, service string, cancellation_reason if any |

### Main search vs history search

| | Main search | History search |
|--|-------------|----------------|
| Fields | plate, model, service, phone | plate only |
| Date filter | applied | **not** applied |
| Status filter | applied | not applied |
| Purpose | filter today’s queue view | find past visits by plate |

---

## 3. “Daily reset” — important clarification

**There is no midnight wipe, cron, or “reset day” button.**

What staff experience as a “new day”:

| Mechanism | What happens |
|-----------|----------------|
| Default `dateFilter = 'today'` | At local midnight, yesterday’s jobs drop out of the default view |
| Default `statusFilter = 'waiting'` | Focuses active intake |
| Data in DB | Unchanged — completed/cancelled/waiting jobs remain |
| Soft delete overnight | Does **not** happen |
| Daily total | Recalculated for whatever date filter is selected (sum of completed `total_cost`) |

### Date key for filters

```
if status === 'completed' && completed_at
  use completed_at
else
  use created_at
```

Compare using **local calendar date** (legacy normalizes both sides to local noon then `toDateString()`).

### Date filter options (actual UI)

| Value | Behavior |
|-------|----------|
| `today` | Same local calendar day |
| `all` | No date restriction (“All Time”) |
| `custom` | Single day **or** `{ start, end }` range |

Quick picks (Yesterday / This Week / Last Week) set `dateFilter = 'custom'` with computed dates.  
`goToToday` sets **custom** with today’s string (not the `'today'` enum — quirk).

### Daily total

```
completedDailyTotal = sum(total_cost) for vehicles where
  status === 'completed'
  AND date filter matches
```

No “reset totals” action — totals are always a live sum of matching completed jobs.

### Port recommendation

- Keep “Today” as default so the floor feels like a fresh day.
- Optionally add an explicit End of Day report; do **not** delete rows unless product asks.
- Document timezone: shop is PH (UTC+8); avoid UTC-midnight bugs on custom ranges (`new Date('YYYY-MM-DD')` is UTC).

---

## 4. Sort & queue number (tied to “day” UX)

| Context | Sort |
|---------|------|
| Waiting list | Oldest `created_at` first |
| Completed list | Newest `updated_at` first (not `completed_at`) |
| Queue `#` | When status filter is waiting: `index + 1` (used in SMS) |

---

## 5. Soft delete vs daily view

| Action | Behavior |
|--------|----------|
| `removeCar` | Sets `is_deleted: true`; drops from local list |
| All fetches | `.eq('is_deleted', false)` |
| UI delete button | Soft-delete implemented in context but **not wired** on QueueItem |

Deleted cars never autofill or appear in history panel (not loaded).

---

## 6. Scenario matrix — day / history

| Scenario | Expected |
|----------|----------|
| Returning customer, plate `ABC-1234` typed with dash, prior visit in DB | Autofill model/phone/size after 500ms |
| Same plate still `waiting`/`in-progress`/`payment-pending` | Add blocked as duplicate |
| Same plate only `completed` yesterday | Add allowed; autofill works; new job is today |
| Staff opens app next morning | Default Today + Waiting; yesterday completed hidden unless All Time / history |
| Search history for yesterday’s plate while Today filter on | History panel still finds it if row is loaded |
| Daily total at noon | Sum of today’s completed only |
| Switch date to Yesterday | Total becomes yesterday’s completed sum |

---

## 7. Remove from new app (motorcycles)

Do **not** port:

- `searchMotorcycleHistory`
- Motorcycle plate autofill in `AddMotorcycleForm`
- History/search combined with `Motor` type
- Any daily counts that include motorcycles (`MobileView` / `CustomerView` / busy-crew merging MC)
