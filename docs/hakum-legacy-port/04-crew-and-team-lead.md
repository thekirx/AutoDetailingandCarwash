# 04 — Crew Rules & Team Lead Account Mapping

Source: `CrewManager.tsx`, `QueueContext.tsx`, `QueueItem.tsx`, `AddCarForm.tsx`, `validation.ts`, `Layout.tsx`, `src/types/index.ts`.

## Critical finding: no team-lead login in legacy

Hakum does **not** implement accounts, roles, or a “team lead” login.

Evidence:

- No login route in `App.tsx`
- Supabase anon key used for all CRUD
- `Layout` nav is open to anyone with the URL
- `CrewMember.role` exists on the type/DB but **CrewManager never reads or writes `role`**
- “Team leader” / “admin” appear only in **SMS copy** for payment-pending (shop language), not as auth

When the new app has a **Team Lead** account, map it to the **entire legacy staff surface** described below.

---

## Team Lead capability set (what to grant in the new app)

Map these legacy screens/actions to the Team Lead role:

| Capability | Legacy route / UI | Notes |
|------------|-------------------|--------|
| Manage live queue | `/` QueueManager + QueueList + QueueItem | Add/edit cars, all status transitions |
| Cancel with reason | CancellationModal | Mandatory reason |
| Assign crew / start service | QueueItem crew UI | Busy-today rules |
| View daily totals | QueueList completed sum | Date-filtered |
| Search / history by plate | QueueList | Cross-day plate history |
| Manage crew roster | `/crew` CrewManager | Name + optional phone |
| Manage services & packages | `/services` ServicesPage | Size pricing CRUD |
| Open customer TV | `/customer` | Often on a separate display |
| Open mobile counts | `/mobile` | Phone glance board |
| Trigger BusyBee SMS | Implicit on add/status | Via `/api/send-sms` |

Optional capabilities **not** present in legacy (add in new app if desired):

- Login / session
- Separate roles: cashier, crew-only, owner, auditor
- Permission to delete jobs (soft delete exists server-side but UI unwired)
- Audit log of who changed status

### Suggested role split for new system

| Role | Suggested scope |
|------|-----------------|
| **Team Lead** (primary port of legacy UI) | Full queue + crew + catalog + SMS triggers + display links |
| Crew (new) | Read queue / see own assignments only (not in legacy) |
| Owner/Admin (new) | Users, pricing, reports, secrets |
| Display (kiosk) | `/customer` and `/mobile` equivalents — no mutations |

---

## Crew member model

```ts
interface CrewMember {
  id: string;
  name: string;
  phone?: string;
  role?: string;      // unused in UI
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
```

### Crew CRUD (`CrewManager`)

- Fields used: **name** (required), **phone** (optional)
- Phone validation in CrewManager: if present, exactly **11 digits** (stricter/different from customer phone `09…` / `+639…` regex — normalize in the new app)
- Soft delete via `removeCrew` / `is_deleted` pattern in context
- Inactive / deleted crew should not be assignable

---

## Busy-today rule

A crew member is **busy** if they appear in `crew[]` of another vehicle where:

1. `status === 'in-progress'`, and
2. Vehicle `created_at` is **calendar today** (local date)

Used in:

- Add car form (cars only in that form’s helper)
- Edit car / Start Service (legacy also considered motorcycles in QueueItem — **ignore MC in port**)

Busy crew checkboxes are disabled. `validateCrewAvailability` rejects selecting busy IDs.

When checking busy for edit/start, **exclude the current vehicle’s id** so reassignment of its own crew works.

---

## Assignment rules

| Rule | Behavior |
|------|----------|
| Crew required | For `in-progress` unless job has a package ID |
| Auto-promote | Assigning crew on `waiting` → set `in-progress` |
| Clear crew | Any transition to `waiting` clears `crew` |
| Package selected | Skip crew UI on Start Service; crew optional |
| Crew UI enabled | Forms enable crew selection when status is `in-progress` (`shouldEnableCrewSelection`) |

---

## Shop-floor language in SMS (not auth)

Payment-pending BusyBee templates say things like:

> “Our **team leader** just finished doing the final check… ready for pickup and payment in our **admin**.”

That is customer-facing copy reflecting the **QC / handover step**, not a separate account type. Keep equivalent wording if rebranding templates for the new product.

---

## Implementation checklist for Team Lead in new app

1. Authenticated role `team_lead` (or equivalent) with full queue + catalog + crew permissions.
2. Replicate status transitions and crew busy rules from [02-operations-queue.md](./02-operations-queue.md).
3. Gate mutations server-side (do not rely on open RLS like legacy).
4. Keep display routes readable without team-lead session **or** use a display token.
5. Do not invent a legacy “team lead password” — it never existed; build it fresh.
