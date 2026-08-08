# Hakum Legacy Port Guide (Cars Only)

**Source app:** `Hakam-Bacoor-main` (Hakum Auto Care — Vite + React + Supabase)  
**Target app:** `AutoDetailingandCarwash` (new, more complete system)  
**Scope:** Cars only. Do **not** port motorcycle tables, routes, forms, or BusyBee call sites.

This folder is the contract for another AI (or engineer) to re-implement **operational logic**, **services**, **team-lead / staff capabilities**, **mobile responsiveness**, and **BusyBee SMS** from the legacy shop-floor app.

## Read order

| # | File | Purpose |
|---|------|---------|
| 1 | [01-overview.md](./01-overview.md) | Architecture, data model, what maps where |
| 2 | [02-operations-queue.md](./02-operations-queue.md) | Full car queue lifecycle, statuses, filters, totals |
| 3 | [03-services-and-packages.md](./03-services-and-packages.md) | Catalog, size pricing, packages, CRUD rules |
| 4 | [04-crew-and-team-lead.md](./04-crew-and-team-lead.md) | Crew rules + how “team lead” maps (legacy had no login) |
| 5 | [05-mobile-responsiveness.md](./05-mobile-responsiveness.md) | Breakpoints, Layout, Queue, Customer/Mobile views |
| 6 | [06-busybee-integration.md](./06-busybee-integration.md) | Brandtxt contract, templates, API, env, port recipe |
| 7 | [07-copy-checklist.md](./07-copy-checklist.md) | Exact copy / skip / fix list for the new project |
| 8 | [08-busybee-env-and-edge-function.md](./08-busybee-env-and-edge-function.md) | **Live API keys**, `.env` values, Supabase Edge Function deploy steps |
| 9 | [09-autofill-and-daily-behavior.md](./09-autofill-and-daily-behavior.md) | Plate autofill, history panel, “daily reset” = Today filter (no wipe) |
| 10 | [10-validations-errors-scenarios.md](./10-validations-errors-scenarios.md) | Every validation, error UX, edge-case scenarios; **remove motorcycles** |

## Non-negotiables for the port

1. **Cars only** — **remove** all motorcycle tables, routes, forms, validators, BusyBee call sites, and busy-crew/display counts that merge MCs.
2. **BusyBee (Brandtxt) is the live SMS provider** — do not revive Twilio unless product asks.
3. **Legacy has no auth** — the whole staff UI is one shared “operator / team lead” surface. Map those capabilities onto the new app’s **team lead** role.
4. **Fix known bugs while porting** (documented in BusyBee + checklist): swallowed SMS errors, open SMS API, `VITE_` secret prefix.
5. **No midnight data wipe** — “new day” is the default `dateFilter = today` only; see doc 09.

## Source of truth paths (legacy)

```
src/types/index.ts
src/context/QueueContext.tsx
src/components/QueueManager.tsx
src/components/QueueList.tsx
src/components/QueueItem.tsx
src/components/AddCarForm.tsx
src/components/EditCarForm.tsx
src/components/ServicesPage.tsx
src/components/CrewManager.tsx
src/components/CustomerView.tsx
src/components/MobileView.tsx
src/components/Layout.tsx
src/lib/validation.ts
MyBusyBee/scripts/busybee-sms.js
api/index.js
api/send-sms.js
server.js
vite.config.ts
vercel.json
```

## Verification note

Facts in these docs were cross-checked against the legacy codebase (status transitions, BusyBee payload, phone conversion, Layout breakpoints, absence of team-lead auth). Prefer the **code paths above** if the new app already has a stronger pattern — copy *behavior*, not Bolt starter structure.
