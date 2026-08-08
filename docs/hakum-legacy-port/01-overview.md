# 01 — Overview (Cars Only)

## What the legacy app is

Hakum Auto Care is an **in-shop queue management SPA** for a car wash / auto detailing floor:

- Staff add cars, assign crew, advance status, take payment, complete jobs.
- Customers see a lobby/TV board and a simple phone “live counts” page.
- SMS updates go out via **BusyBee → Brandtxt** when a phone number is present.
- Catalog (services + packages) and crew are managed in-app.
- Data lives in **Supabase Postgres**; nightly backups go to **Airtable** (ops mirror — not required for core queue).

Scaffold origin: Bolt Vite/React (`.bolt/config.json` → `bolt-vite-react-ts`). Package name still `vite-react-typescript-starter`.

## Tech stack (legacy)

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TypeScript, Tailwind, react-router-dom |
| State | `QueueContext` (load once on mount; **no realtime subscribe**) |
| DB | Supabase (`@supabase/supabase-js` anon key) |
| SMS | BusyBee Brandtxt via `POST /api/send-sms` |
| Deploy | Vercel SPA + serverless `api/index.js` |
| Local SMS | Express `server.js` on `:3000` + Vite proxy `/api` |

## Architecture (cars path only)

```
Staff UI (Layout routes)
  ├── Queue (/)           → add/edit cars, status actions, filters, daily total
  ├── Crew (/crew)        → crew CRUD
  ├── Car Services (/services) → services + packages CRUD
  └── (displays without Layout)
        ├── Customer View (/customer)  → TV 3-column board
        └── Mobile View (/mobile)      → waiting + in-progress counts

QueueContext
  └── Supabase tables: cars, services, service_packages, crew_members

SMS (parallel to DB writes from UI)
  └── fetch('/api/send-sms') → busybee-sms.js → Brandtxt SendSMS
```

## Car data model (must preserve conceptually)

Statuses (`ServiceStatus`):

```
waiting → in-progress → payment-pending → completed
                 ↘ cancelled (from waiting / in-progress / payment-pending)
```

| Field | Meaning |
|-------|---------|
| `plate` | Uppercase plate; format with exactly one `-` (e.g. `ABC-1234`) |
| `model` | Vehicle model string |
| `size` | `small` \| `medium` \| `large` \| `extra_large` |
| `service` | Comma-joined **display names** of selected services/packages |
| `services` | Array of **IDs** (service IDs and/or package IDs mixed) |
| `status` | Lifecycle status |
| `phone` | Optional PH mobile |
| `crew` | Array of `crew_members.id` |
| `total_cost` | PHP amount |
| `created_at` / `updated_at` | Timestamps |
| `completed_at` | Set when status → `completed` |
| `cancellation_reason` | Free text when cancelled |
| `is_deleted` | Soft delete |
| `time_waiting` | Waiting clock start |
| `time_in_progress` | Service start |
| `time_ready_for_payment` | Intended end of in-progress / start of payment wait |

**Port note:** Legacy client **auto-sets** `time_in_progress`, `completed_at`, and sometimes `time_waiting`. It does **not** reliably write `time_ready_for_payment` / `payment_pending_at` on status change — fix this in the new app if you show process durations.

## Tables to port (cars)

- `cars`
- `services` (filter / tag `vehicle_type = 'car'` or drop vehicle_type if cars-only)
- `service_packages`
- `crew_members`

**Do not port:** `motorcycles`, motorcycle services UI, MC BusyBee call sites.

## Do not port (motorcycles)

The new system is **cars only**. Remove motorcycle tables, routes, forms, validators (`validateMotorcycle*`), BusyBee MC call sites, and any busy-crew / display logic that merges motorcycles. See [10-validations-errors-scenarios.md](./10-validations-errors-scenarios.md) §O.

## Auth reality (critical for “team lead account”)

Legacy app has:

- **No login UI**
- **No RBAC**
- Open Supabase RLS policies (`USING (true)` / “Allow all for everyone”)
- Nav links available to anyone with the URL

Therefore: treat the entire Layout staff surface as the **Team Lead / Shop Operator** capability set. See [04-crew-and-team-lead.md](./04-crew-and-team-lead.md).

## Dead / do-not-copy systems

| Item | Why skip |
|------|----------|
| `src/lib/sms.ts` + `supabase/functions/twilio-sms` | Unused Twilio path |
| `temp_migrations/*sms_notification_trigger.sql` | Wrong schema (`customers`, `plate_number`) |
| Motorcycle forms/pages/routes | Out of scope |
| `SECURITY-AUDIT.md` claims | Marketing; not implemented (no CSRF, no real RBAC) |

## Display routes (no Layout chrome)

| Route | Audience | Behavior |
|-------|----------|----------|
| `/customer` | Lobby TV | 3 columns: Waiting / In Progress / Ready for Payment |
| `/mobile` | Phone glance | Big counts for waiting + in-progress only |

Both wrap `QueueProvider` but do **not** poll or subscribe — they only update if the same browser session mutates context, or on full reload. New app should add realtime or polling for multi-device.
