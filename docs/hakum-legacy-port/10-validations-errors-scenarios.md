# 10 — Validations, Errors & Specific Scenarios (Cars Only)

**Scope:** Every input rule, error path, and edge-case behavior the Team Lead UI relies on.  
**Motorcycles:** Remove entirely — do not port `validateMotorcycle*`, MC forms, MC duplicate rules, or MC SMS.

---

## A. Shared validators (`src/lib/validation.ts`) — cars

| Validator | Rule | Error message |
|-----------|------|---------------|
| `validateLicensePlate` | required; trim+upper; length 3–8; must contain `-`; exactly 2 non-empty parts | `License plate is required` / `…at least 3…` / `…too long` / `Please include a dash (-) in the plate number` / `…valid characters before and after the dash` |
| `validatePhoneNumber` | empty = OK; else strip spaces; `/^(09\|\+639)\d{9}$/` | `Please enter a valid Philippine phone number starting with 09 or +639 followed by 9 digits` |
| `validateCarModel` | required; trim; 2–100 chars; ban `<script`, `javascript:`, `on\w+=`, `data:text/html` | required / length / `Car model contains invalid characters` |
| `validateCost` | number; ≥ 0; ≤ 100000 | NaN / negative / `Cost seems unusually high…` |
| `validateCarSize` | `small\|medium\|large\|extra_large` | `Please select a valid car size` |
| `validateServiceStatus` | five statuses | `Please select a valid status` |
| `validateCrewForStatus` | if `in-progress` and no package and crew empty → fail | `At least one crew member must be assigned when status is "In Progress" and no package is selected.` |
| `validateCrewAvailability` | any selected id in busy set → fail | `Some selected crew members are currently busy. Please select different crew members.` |
| `shouldEnableCrewSelection` | true only when status is `in-progress` | — |
| `isCrewSelectionRequired` | `in-progress && !hasPackage` | — |
| `RateLimiter` | 5 attempts / 60s | **Defined but unused** by forms — optional to wire |

**Do not port:** `validateMotorcyclePlate`, `validateMotorcycleModel`, `validateMotorcycleSize`.

---

## B. Add Car form validation (`AddCarForm`)

Header when invalid: `Please fix the following errors:`

| Field | Rule | Notes |
|-------|------|-------|
| Plate | required; must include `-` | Does **not** call full `validateLicensePlate` (no max-8 on submit). HTML `maxLength={15}` |
| Model | required; 2–100 | Inline; no XSS pattern check on Add |
| Phone | optional; if set PH regex | same as shared |
| Size / status | whitelist | status add UI: waiting \| in-progress only |
| Services/packages | ≥ 1 service **or** package | `Please select at least one service or package.` |
| Crew | `validateCrewForStatus` + `validateCrewAvailability` | |
| Duplicate | same plate (upper trim) in `waiting\|in-progress\|payment-pending` | Block add |
| Cost | **not validated** on submit | Manual override can be any number |

### Soft-force scenarios (Add)

| Condition | Result |
|-----------|--------|
| User chose `in-progress` but selected busy crew | Force `waiting`, clear crew, set form error (form may still close — legacy UX bug) |
| User chose `in-progress`, no package, no crew | Force `waiting` + message |
| Package selected | `in-progress` allowed without crew |

Selecting a package **clears crew** on Add.

---

## C. Edit Car form validation (`EditCarForm`)

Header: `Please fix the errors below.`

| Field | Rule | Notes |
|-------|------|-------|
| Plate | must include `-`; blur uses full `validateLicensePlate` | HTML `maxLength={8}` |
| Duplicate | other cars with same plate in `waiting\|in-progress` only | **Does not** block if other is `payment-pending` (differs from Add) |
| Model / phone / size / status | shared validators | |
| Cost | `validateCost` **and** must be `≥ 1` | Zero/free blocked on edit |
| Services | required if status is waiting or in-progress | |
| Completed car | Save button **disabled** | Pencil hidden on QueueItem when completed |

Phone typing: strips non-digits/+; inserts spaces (`09xx xxx xxxx`); validator strips `\s` so OK.

---

## D. Cancellation validation

| Rule | Message |
|------|---------|
| Required (trim) | `Cancellation reason is required` |
| Min 3 chars | `…at least 3 characters long` |
| Max 500 chars | `…less than 500 characters` |

Presets: can't wait / doesn't want service / needs to be somewhere / Others (custom).  
Esc closes; Ctrl/Cmd+Enter submits. Submit disabled until min length.

---

## E. Crew Manager validation

| Field | Rule | Message |
|-------|------|---------|
| Name | required; letters + spaces only `/^[A-Za-z\s]+$/` | required / letters only |
| Phone | optional; if set **exactly 11 digits** `/^\d{11}$/` | `Phone number must be exactly 11 digits` |

**Inconsistency:** Customer phone uses `09…` / `+639…`; crew phone is 11 digits. Normalize in the new app or keep both documented.

---

## F. Services / Packages validation

| Entity | Rule | Message |
|--------|------|---------|
| Service | name required; **no price validation** | `Service name is required.` |
| Package | name required; ≥ 1 `service_ids` | name / `At least one service must be included…` |
| Save fail | | `Failed to save service/package: … Please try again.` |

Legacy service create often **omits** `vehicle_type: 'car'` — packages set it. Cars-only app: drop `vehicle_type` or always set car.

---

## G. Cost calculation scenarios

| Scenario | Behavior |
|----------|----------|
| Select services/packages | Sum `pricing[size]` (fallback `service.price` or 0 for package) |
| Change size | Recompute unless cost overridden |
| Manual edit of total (Add) | Sets override flag; stops auto-sync |
| Submit Add | `manualTotalCost !== '' ? Number(manual) : calculated` — no min/max |
| Submit Edit | Must pass `validateCost` and `≥ 1` |
| Edit in-progress with no services | Attempts cost 0 then blocked by ≥ 1 |

---

## H. Busy crew scenarios

Busy = assigned on another car with `status === 'in-progress'` **and** that car’s `created_at` is **calendar today**.

| Scenario | Behavior |
|----------|----------|
| Checkbox busy | Disabled + “Busy” badge |
| Select busy anyway | Validation error |
| Edit / Start Service | Exclude **current** car’s own crew from busy set |
| Package job | Crew optional |
| Start Service without package | Open crew picker; assign ≥1 → auto `in-progress` + SMS |
| Start Service with package | Skip picker → `in-progress` |

**Port:** Busy set must be **cars only** (legacy QueueContext also merges motorcycles — remove that).

---

## I. Status / queue scenarios

| Scenario | Expected |
|----------|----------|
| Waiting → Start (no package) | Crew required |
| Waiting → Start (package) | No crew UI |
| Assign crew while waiting | Auto-promote to in-progress; SMS |
| Send to Waiting | `crew = []` always (UI + `updateCar`) |
| Ready for Payment | → `payment-pending`; SMS |
| Mark Completed | Set `completed_at`; retries up to **3** with exponential backoff; verify status |
| Cancel | Reason required; **no SMS** |
| Concurrent update same vehicle | If operation already active → **silent return** (no second update) |
| Completed car edit | Not allowed |
| Duplicate active plate (Add) | Block waiting/in-progress/payment-pending |
| Duplicate (Edit) | Block waiting/in-progress only |
| Same plate completed yesterday | New job allowed (returning customer) |

### Status machine

```
waiting        → in-progress | cancelled
in-progress    → payment-pending | waiting | cancelled
payment-pending→ completed | waiting | cancelled
completed / cancelled → (no quick actions)
```

---

## J. Timestamp / duration scenarios

| Status | What UI shows | Fallback |
|--------|---------------|----------|
| waiting | live Time Waiting | `time_waiting \|\| created_at` |
| in-progress | static Total Waiting + live Process | process from `time_in_progress` |
| payment-pending | waiting + process (end `time_ready_for_payment`) | Client often **doesn't set** payment timestamp — fix in port |
| completed | waiting, process, total service | ends at `completed_at` |
| cancelled | waiting until `updated_at` + cancelled stamp | |
| Missing start | Display **`0m`**, never blank | |
| Tick | Re-render every **60s** while waiting/in-progress | |

Client auto-sets on update if missing: `time_in_progress`, `completed_at`, `time_waiting`.

---

## K. SMS scenarios (errors)

| Scenario | Behavior (legacy) | Port fix |
|----------|-------------------|----------|
| Add with phone | Send SMS | keep |
| Add without phone | Skip | keep |
| Status ≠ cancelled | `fetch` SMS | skip if empty phone |
| Cancel | No SMS | keep |
| Brandtxt failure | Swallowed → false success | return 500 + toast |
| Empty phone on status change | Still POSTs → API 400 ignored | skip client-side |
| Crew-assign + status both SMS | Possible double in-progress | send once |

---

## L. Error UX map

### QueueContext / load

| Failure | UX |
|---------|-----|
| Fetch cars/services/crew/packages | `Failed to load …`; QueueList shows error + **reload page** button |
| `clearError` | Clears context + loading error |

### AddCarForm catch (substring heuristics)

| If message contains | User sees |
|---------------------|-----------|
| `license plate already exists` | already in queue / returning customers copy |
| `required fields` | fill asterisk fields |
| `Invalid data` | check input |
| `Access denied` | permission / contact administrator |
| `Database table not found` | system error / support |
| else | raw `error.message` |

Note: `addCar` usually throws `Failed to add vehicle: ${supabase.message}` — substrings often **won’t** match unless DB text aligns. Prefer structured error codes in the new app.

### QueueItem actions

Status / delete / assign / cancel failures → `alert('Failed to …')`.

### Completion retries (`useLoadingState`)

| Type | maxRetries | Delay |
|------|------------|-------|
| completion | 3 | exponential `1000 * 2^(attempt-1)` |
| other updates | 1 | 1000ms |
| verify fail | | `Operation verification failed. Please try again.` |

### Services / Crew forms

Field-level `errors` object + form-level save failure string.

### Offline

`useOfflineQueue` exists but is **never imported** — dead. Online/offline not integrated. Port only if product wants offline queue.

---

## M. Loading / UI state scenarios

| State | Behavior |
|-------|----------|
| Initial load | Global `loading` until fetches finish; list `"Loading..."` |
| Form submit | `isSubmitting` disables buttons |
| Per-vehicle transaction | Spinner on completion path |
| Autofill search | Plate field spinner |
| Theme | light/dark; `localStorage`; default dark unless system prefers light |

---

## N. Calendar / filter edge cases

| Quirk | Detail |
|-------|--------|
| Default | status=`waiting`, date=`today` |
| Custom range | `new Date('YYYY-MM-DD')` is UTC midnight vs local noon compare → PH timezone risk |
| This week | Sun–Sat in legacy quick pick |
| History open with Today filter | Still finds older plates if loaded |
| Completed sort | `updated_at` desc, not `completed_at` |

---

## O. Motorcycle removal checklist (new app)

Remove / do not reimplement:

- [ ] `motorcycles` table usage in Team Lead UI  
- [ ] `AddMotorcycleForm`, `EditMotorcycleForm`, MC services pages  
- [ ] QueueManager car/MC toggle  
- [ ] `validateMotorcycle*` helpers  
- [ ] MC BusyBee call sites  
- [ ] Busy-crew / CustomerView / MobileView counting motorcycles  
- [ ] `searchMotorcycleHistory`  

Keep only car plate/model/size/validation paths.

---

## P. Porting “must not miss” list

1. Autofill: debounce + dash gate + history fills model/phone/size only ([09](./09-autofill-and-daily-behavior.md)).  
2. No real daily DB reset — Today filter only.  
3. Duplicate rules differ Add vs Edit.  
4. Waiting always clears crew.  
5. Package waives crew.  
6. Busy = in-progress **created today**.  
7. Completed not editable.  
8. Add cost unconstrained; Edit cost ≥ 1.  
9. Plate maxLength 15 (Add) vs 8 (Edit) — unify.  
10. SMS + load errors need real UX in new app.  
11. Completion retry ×3.  
12. Soft-force-to-waiting may close form before user reads error — fix UX.  
13. Remove all motorcycle logic.
