# Full-system audit pack — 2026-08-01

**Purpose:** Residual readiness pass after role deep audits. Prior `audits/*-deep/` packs fixed most CRITICAL / HIGH role bugs. This pack is **page-level checklists**, **HTML flow maps**, **open/deferred defects only**, plus a **database-scale** track and a **go/no-go readiness** scorecard.

**Date:** 2026-08-01  
**Repo:** AutoDetailingandCarwash  
**Scope:** Docs only under `audits/full-system-2026-08-01/` (no application source changes in this pass).

---

## How to use

1. Open [`index.html`](./index.html) in a browser for the dashboard (Tailwind CDN; works offline for layout once cached).
2. Pick a **role pack** below → read `00-README.md` → walk `01-page-checklist.md` with a live session → track leftovers in `02-open-defects.md` → use `flows.html` as the visual nav/status map.
3. Run [`01-READYNESS-CHECKLIST.md`](./01-READYNESS-CHECKLIST.md) as the single yes/no gate for soft launch / multi-TL / ASA honesty / scale / BusyBee / SMTP / secrets.
4. Run [`database-scale/`](./database-scale/) before any “50+ concurrent users” claim.
5. Cross-check prior deep audits (links below) — do **not** re-open Fixed CRITICAL items unless regression is proven.

### Checkbox convention

| Mark | Meaning |
|------|---------|
| `[ ]` | Not verified this pass |
| `[x]` | Verified OK on 2026-08-01 evidence |
| **Ready** | Primary path works end-to-end for the role |
| **Partial** | Usable with known gaps (see open defects) |
| **No** | Blocked / denied / not ready for that role |

---

## Role packs (index)

| Pack | Role | Home | Status summary | Flows |
|------|------|------|----------------|-------|
| [super-admin/](./super-admin/) | BossMich / Super Admin | `/operations/console` | Most pages Ready; console/people/crew/dashboard/reports/login Partial | [flows.html](./super-admin/flows.html) |
| [asa/](./asa/) | Assistant Super Admin | `/operations/console` | Same minus cars/data-center; ASA-M1/M2 open; grants honesty P0 | [flows.html](./asa/flows.html) |
| [admin/](./admin/) | Branch Admin | `/operations/console` | No reports/cars/data-center/queue-new/redo; memberships weight Save polish | [flows.html](./admin/flows.html) |
| [team-lead/](./team-lead/) | Team Lead | `/operations/dashboard` | Floor/queue/crew/kpi/bookings Ready; no POS; TL-C5 deferred | [flows.html](./team-lead/flows.html) |
| [staff/](./staff/) | Staff | `/operations/my-tasks` | My Tasks only — Partial (STF-H1 geo) | [flows.html](./staff/flows.html) |
| [marketing/](./marketing/) | Marketing | `/operations/crm` | CRM Partial (events/push deferred) | [flows.html](./marketing/flows.html) |
| [customer/](./customer/) | Customer | `/account` | Signup/account/set-password Ready; signin Partial | [flows.html](./customer/flows.html) |
| [public/](./public/) | Anonymous public | `/` | book/queue Ready; contact/complaints/events/landing Partial | [flows.html](./public/flows.html) |
| [database-scale/](./database-scale/) | Postgres / RLS / indexes | — | Queue UNIQUE + dual ledgers + grant/RLS honesty | [flows.html](./database-scale/flows.html) |

Master readiness: [`01-READYNESS-CHECKLIST.md`](./01-READYNESS-CHECKLIST.md)

---

## Prior deep audits (authoritative for Fixed CRITICAL)

| Prior pack | Link |
|------------|------|
| Super Admin | [`../super-admin-deep/`](../super-admin-deep/) |
| ASA | [`../asa-deep/`](../asa-deep/) |
| Admin | [`../admin-deep/`](../admin-deep/) |
| Team Lead | [`../team-lead-deep/`](../team-lead-deep/) |
| Staff | [`../staff-deep/`](../staff-deep/) |
| Marketing | [`../marketing-deep/`](../marketing-deep/) |
| Customer (+ public surfaces) | [`../customer-deep/`](../customer-deep/) |
| UI dead controls | [`../ui-dead-controls/`](../ui-dead-controls/) |

**Note:** Deep audits closed most CRITICAL role bugs (scope leaks, POS crashes, provision gates, Marketing CRM RLS, customer Realtime PII, etc.). This pack tracks **residuals**, **cross-cutting P0**, and **full page checklists**.

---

## Readiness scorecard (2026-08-01)

| Gate | Score | Verdict |
|------|-------|---------|
| Soft launch (single branch, SA + TL + Staff + public book) | **72 / 100** | Conditional — fix queue UNIQUE + Reports silent errors first |
| Multi-TL floor (same branch concurrent) | **55 / 100** | Hold — no UNIQUE on daily queue numbers; race risk |
| ASA grant honesty (UI ↔ RPC ↔ RLS) | **48 / 100** | Hold — pos/finance/reports grants UI-only; ASA-M1/M2 |
| Scale 50+ concurrent authenticated users | **40 / 100** | Hold — eager ~980KB chunks ×3, in-memory rate limits, index gaps |
| BusyBee SMS | **70 / 100** | Conditional — bearer fixed; templates/send paths Ready; ops secrets + provider quotas |
| SMTP / password recovery | **65 / 100** | Conditional — OPS-M3 bounce path; CUST-H2 phone-only |
| Secrets / env hygiene | **60 / 100** | Conditional — verify production env; never commit service role |

Overall go/no-go for **company soft launch:** **NO-GO until P0 backlog cleared** (or explicitly accepted with named owners).

---

## P0 → P3 backlog (this pass)

### P0 — block soft launch / multi-TL / ASA honesty

| ID | Area | Defect | Owner hint |
|----|------|--------|------------|
| **DB-P0-1** | Queue | No `UNIQUE(branch, queue_date, queue_number)`; `assign_daily_queue_number` missing from git | DB + queue API |
| **ASA-P0-1** | Grants | ASA `pos` / `finance_*` / `reports` grants enforced in UI only; RPCs/RLS ignore | ASA + Postgres |
| **RPT-P0-1** | Reports | `ReportsPage` silent `.error` on expenses / crew / comps / books | SA Reports |
| **PERF-P0-1** | Bundle | Eager `App.jsx` imports — three ~980KB routes, no `React.lazy` | Frontend |
| **OPS-P0-1** | Edge | In-memory rate limits on Vercel (multi-instance ineffective) | API / serverless |
| **AUTH-P0-1** | Session | `getSession` on `PublicUtilityPage` / `NotificationBell` / `userSettings` (stale vs `getUser`) | Auth client |

### P1 — high residual (role packs)

| ID | Notes |
|----|-------|
| SA-M4 / SA-M5 | Console profit window mismatch; no dashboard export |
| SA-M6 | People email/password edit UI deferred |
| Crew geo / temp pwd | Crew Partial for SA |
| OPS-M3 | Ops forgot-password → customer set-password bounce |
| OPS-M7 | Membership weight Save disabled but visible (Admin) |
| ASA-M1 / ASA-M2 | Expenses RLS / `complete_pos_sale` ignore grants |
| STF-H1 | Client-only geofence |
| CUST-H2 | Phone-only password reset |
| CUST-H9 | Contact / complaints / events open insert (spam) |
| PUB-7 | Coating cards generic `/book` |
| MKT events/push | Deferred fan-out |

### P2 — medium polish

| ID | Notes |
|----|-------|
| OPS-M2 | Finance Reports tab vs ReportsPage overlap |
| OPS-M6 | Planning Viewer badge (intentional) |
| OPS-M8 | Crew vs People dual provision |
| SA-M7 | My-tasks queue complete edge for SA |
| TL-C5 | Broad customers SELECT / plate search (writes tightened) |
| Dual ledgers / overlapping indexes | See database-scale |

### P3 — backlog / intentional

| ID | Notes |
|----|-------|
| ASA-M3 | CRM/Bookings ungated for ASA (documented intentional) |
| PUB-8/9 | Multiple Book / Push entry points (density) |
| CUST-M2 | Memberships not in customer portal |
| Dashboard Partial | Known SA dashboard gaps |

---

## Inventory snapshot (Ready / Partial / No)

See role `flows.html` tables. Quick map:

- **BossMich:** console Partial · planning Yes · people Partial · branches Yes · cars Yes · audit Yes · data-center Yes · dashboard Partial · queue Yes · queue/new Yes · queue/:id Yes · crew Partial · kpi Yes · my-tasks Yes · pos Yes · finance Yes · crm Yes · bookings Yes · reports Partial · memberships Yes · login Partial  
- **ASA:** same minus cars/data-center; planning viewer; finance view-only default; queue redo Yes; ASA-M1/M2 open  
- **Admin:** no reports/cars/data-center/queue-new/redo; memberships weight Save → OPS-M7  
- **TL:** floor/queue/new/crew/kpi/bookings/my-tasks Yes; no POS; TL-C5 deferred  
- **Staff:** my-tasks Partial (STF-H1)  
- **Marketing:** CRM Partial  
- **Customer:** signin Partial · signup/account/set-password Yes  
- **Public:** book/queue Yes · contact/complaints/events Partial · landing Partial  

---

## Suggested verification commands (evidence, not run in this doc pass)

```bash
node --test tests/uiDeadControls.test.js
node --test tests/customerScope.test.js tests/adminScope.test.js tests/teamLeadScope.test.js
npm run build
```

Live SQL checks for queue UNIQUE / RLS grants: see [`database-scale/01-checklist.md`](./database-scale/01-checklist.md).
