# 07 — Copy Checklist for AutoDetailingandCarwash

Use this as the execution ticket for the other AI on the new project. Cars only. Team Lead role owns the legacy staff surface.

## A. Must implement (behavior)

### Queue / operations

- [ ] Status machine: waiting → in-progress → payment-pending → completed; cancel from active states
- [ ] Quick actions matrix from [02-operations-queue.md](./02-operations-queue.md)
- [ ] Add car: size pricing, services+packages IDs, display names string, optional phone
- [ ] **Plate autofill** (debounce, dash gate, fill model/phone/size) — [09](./09-autofill-and-daily-behavior.md)
- [ ] **History panel** (partial plate, ignores date filter) — [09](./09-autofill-and-daily-behavior.md)
- [ ] **Today filter as “daily reset”** (no midnight wipe) — [09](./09-autofill-and-daily-behavior.md)
- [ ] Force waiting when in-progress without package and without available crew
- [ ] Duplicate active plate rejection (note Add vs Edit difference) — [10](./10-validations-errors-scenarios.md)
- [ ] Cancel with required reason (3–500) + presets
- [ ] Clear crew whenever status returns to waiting
- [ ] Auto-promote waiting → in-progress on crew assign
- [ ] Package skips crew requirement / Start Service picker
- [ ] Daily completed total (sum `total_cost`) with date filter
- [ ] Filters: status + today/all/custom date; search plate/model/service/phone
- [ ] Waiting sort oldest-first; queue number = position in waiting list
- [ ] Set timestamps: `time_in_progress`, `completed_at`, and **`time_ready_for_payment` on payment-pending** (fix legacy gap)
- [ ] Soft delete or audited delete for cars (legacy soft delete unwired in UI)
- [ ] All input/error scenarios from [10](./10-validations-errors-scenarios.md)
- [ ] Completion update retries ×3
- [ ] **Remove all motorcycle logic**

### Services / packages

- [ ] Size pricing map for 4 sizes
- [ ] Service + package CRUD for Team Lead
- [ ] Packages require ≥1 service id
- [ ] Soft-delete / archive catalog rows
- [ ] Cars-only (no motorcycle vehicle_type branching)

### Crew + Team Lead account

- [ ] Authenticated **Team Lead** role with full queue + crew + catalog permissions ([04](./04-crew-and-team-lead.md))
- [ ] Busy-today rule (in-progress + created today)
- [ ] Validate crew availability before assign
- [ ] Crew CRUD: name + optional phone
- [ ] Display routes for TV + mobile counts (separate from staff chrome)

### Mobile responsiveness

- [ ] Staff nav hamburger at `md` ([05](./05-mobile-responsiveness.md))
- [ ] Queue cards stack on small screens (QueueItem patterns)
- [ ] Custom `xs: 475px` or intentional replacement
- [ ] Customer board = TV-first (do not ship fixed 3-col as “mobile”)
- [ ] Mobile counts page = big numbers for waiting + in-progress
- [ ] Touch targets ≥ 44px (improve on legacy)
- [ ] Realtime or polling for multi-device displays

### BusyBee

- [ ] Server-only Brandtxt credentials (no `VITE_` / `NEXT_PUBLIC_` secrets)
- [ ] Load live keys / Edge secrets from [08-busybee-env-and-edge-function.md](./08-busybee-env-and-edge-function.md)
- [ ] Deploy Supabase Edge Function `busybee-sms` (JWT on); do not reuse Twilio `twilio-sms`
- [ ] Port phone convert + templates + payload ([06](./06-busybee-integration.md))
- [ ] Team Lead UI: `supabase.functions.invoke('busybee-sms', …)` (or gated `/api/send-sms`)
- [ ] SMS on add (if phone), on status change except cancelled, on waiting→in-progress
- [ ] **Rethrow Brandtxt errors** → real 500s
- [ ] Skip SMS when phone empty
- [ ] Deduplicate in-progress SMS
- [ ] Rebrand templates away from “Hakum Auto Care” as needed
- [ ] Document env var **names** in `.env.example`; secrets only in Supabase/host env

## B. Copy as reference (rewrite into new stack)

Prefer **behavior port**, not file paste. Useful reference modules:

| Legacy | Use for |
|--------|---------|
| `src/lib/validation.ts` | Plate/phone/cost/crew rules |
| `src/types/index.ts` | Status + size enums (cars only) |
| `MyBusyBee/scripts/busybee-sms.js` | Templates + convert + payload |
| `AddCarForm.tsx` / `EditCarForm.tsx` | Form rules |
| `QueueItem.tsx` | Transitions + SMS triggers |
| `QueueList.tsx` | Filters + daily total |
| `ServicesPage.tsx` | Catalog CRUD |
| `CrewManager.tsx` | Crew CRUD |
| `Layout.tsx` | Responsive nav |
| `CustomerView.tsx` / `MobileView.tsx` | Display boards |

## C. Do not copy

- [ ] All motorcycle routes, forms, table, BusyBee call sites
- [ ] `src/lib/sms.ts` + Twilio edge function
- [ ] `temp_migrations/*sms_notification_trigger.sql` (wrong schema)
- [ ] Open RLS “Allow all for everyone”
- [ ] Client-side Brandtxt calls / `VITE_` SMS secrets
- [ ] Fake claims from `SECURITY-AUDIT.md`
- [ ] Bolt starter package naming / dead imports (`QueueItem` unused `sendSMS` import)
- [ ] Assuming realtime exists (it does not in legacy)

## D. Security upgrades required in new app

Legacy is shop-floor convenience software, not production-hardened.

1. Real auth + Team Lead RBAC  
2. Close RLS / use server role for mutations  
3. Auth-gate SMS endpoint  
4. Rotate any keys that lived in `.env copy`  
5. Stop logging full SMS payloads with ApiKey  

## E. Done definition for the porting AI

The new app is done for this scope when:

1. Team Lead can run a full car job day (add → service → payment → complete/cancel) with the same business rules.  
2. Services/packages price by size.  
3. Crew busy-today + package exception work.  
4. BusyBee SMS fires for the events in §A and fails loudly on API errors.  
5. Staff UI is usable on phone; TV and mobile count boards exist.  
6. No motorcycle code paths remain in the ported feature set.  

Verify with the smoke tests in [06-busybee-integration.md](./06-busybee-integration.md) plus a manual Team Lead walkthrough on a phone viewport.
