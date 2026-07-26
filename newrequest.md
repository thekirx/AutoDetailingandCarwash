# Hakum — Remaining system plan & checklist

**Source:** raw notes in prior `newrequest.md`  
**Principle:** RBAC + navigation + routing first; then module depth. One part per prompt.  
**Done (this doc):** Plan aligned to current code (`permissions.js`, `App.jsx`, Planning board, Finance/POS/CRM as they exist today).  
**Not done until checked:** Implementation of each part.

---

## Finish line (overall)

When every checkbox below is `[x]` and gate scripts pass:

1. Roles match the matrix (no `sales` / `cashier`; **Assistant Super Admin** = configurable elevated role).
2. Every ops route is gated by role **and** matches nav (no orphan links, no dead nav).
3. Admin can be assigned **multiple branches**; data views respect that scope.
4. POS owns Services + Merch; CRM owns SMS; Reports = Super Admin (+ Assistant Super Admin if granted).
5. Module features in later parts match the matrix (queue, KPI, finance, bookings, planning settings, etc.).

---

## Target role model (replaces current)

| Role key | Display | Notes |
|----------|---------|--------|
| `BossMich` | Super Admin (owner) | Full CRUD everywhere; can edit Assistant Super Admin grants |
| `assistant_super_admin` | Assistant Super Admin | Lesser elevated; **default grants** below; BossMich can toggle grants |
| `admin` | Branch Admin | **Multi-branch** assignment; scoped to those branches |
| `team_lead` | Team Lead | Floor / queue / crew / KPI (TL slice); branch-scoped |
| `staff` | Staff | My Tasks (+ assigned queue work) |
| `marketing` | Marketing | CRM (+ SMS tab inside CRM) only |
| ~~`sales`~~ | — | **Remove** (migrate users → `admin` or `nationwide` as decided) |
| ~~`cashier`~~ | — | **Remove** (migrate → `admin`) |

### Assistant Super Admin — default permission grants (BossMich can change)

| Grant key | Default | Meaning |
|-----------|---------|---------|
| `pos` | on | POS + inventory |
| `finance_view` | on | Finance read (branch-all or nationwide) |
| `finance_write` | off | Create expenses / categories |
| `reports` | on | `/operations/reports` |
| `planning_edit` | off | Planning CRUD (default view-only like Admin) |
| `people` | on | People manage (not create BossMich) |
| `branches` | on | Branch CRUD |
| `services_merch` | on | Via POS tabs |
| `queue_all` | on | All-branch queue filter |
| `kpi_all` | on | All-branch KPI |
| `audit` | on | Audit log |
| `memberships` | on | Memberships |
| `rbac_edit` | off | Cannot edit other users’ grants (BossMich only) |

*Implementation note:* store grants in `staff_profiles.permission_grants jsonb` (or `role_grants`); BossMich UI on People.

### Branch assignment

| Role | Branches |
|------|----------|
| BossMich | All (implicit) |
| Assistant Super Admin | All (implicit) when `queue_all` / `kpi_all` grants on |
| Admin | **Many** via `staff_branch_assignments` |
| Team Lead / Staff | One primary `branch_slug` (keep) |

---

## Target navigation matrix (source of truth)

Routes listed = allowed. Everything else → `/operations/access-denied` or redirect home.

| Nav / route | BossMich | Assistant Super Admin | Admin | Team Lead | Staff | Marketing |
|-------------|----------|------|-------|-----------|-------|-----------|
| `/operations/console` | ✓ | ✓ | ✓ | — | — | — |
| `/operations/planning` | ✓ CRUD | ✓ view* | ✓ view | — | — | — |
| `/operations/people` | ✓ | ✓* | ✓ scoped | — | — | — |
| `/operations/branches` | ✓ | ✓* | ✓ scoped | — | — | — |
| `/operations/audit` | ✓ | ✓* | ✓ | — | — | — |
| `/operations/dashboard` | ✓ all + filters | ✓ all + filters | ✓ assigned branches | ✓ own branch (+ TL filters) | — | — |
| `/operations/queue` | ✓ all + branch filter CRUD | ✓* | ✓ assigned | ✓ own (edit) | view assigned | — |
| `/operations/crew` | ✓ | ✓* | ✓ assigned | ✓ own | — | — |
| `/operations/kpi` | ✓ full | ✓* | ✓ assigned | ✓ TL sales/complaints slice | — | — |
| `/operations/my-tasks` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `/operations/pos` | ✓ | ✓* | ✓ assigned | — | — | — |
| `/operations/finance` | ✓ | ✓* | ✓ assigned | — | — | — |
| `/operations/crm` (+ SMS tab) | ✓ | ✓* | ✓ | — | — | ✓ |
| `/operations/bookings` | ✓ | ✓* | ✓ assigned | ✓ | — | — |
| `/operations/reports` | ✓ | ✓* | — | — | — | — |
| `/operations/memberships` | ✓ | ✓* | ✓ | — | — | — |
| `/operations/services` | **remove** → POS tab | | | | | |
| `/operations/products` | **remove** → POS tab | | | | | |
| `/operations/sms` | **redirect** → `/operations/crm?tab=sms` | | | | | |

\* = if grant enabled (Assistant Super Admin defaults above).

### Default home (`redirectForRole`)

| Role | Home |
|------|------|
| BossMich | `/operations/console` |
| nationwide (Assistant Super Admin) | `/operations/console` |
| admin | `/operations/console` |
| team_lead | `/operations/dashboard` |
| staff | `/operations/my-tasks` |
| marketing | `/operations/crm` |

---

## Gap vs today (why Part 1 is first)

| Today | Target |
|-------|--------|
| Roles include `sales`, `cashier` | Remove; migrate |
| Admin = single `branch_slug` | Multi-branch assignments |
| No Assistant Super Admin / grants | `nationwide` + `permission_grants` |
| Nav shows Services + Merch + SMS | Fold into POS / CRM; redirects |
| Reports = `isAdmin` | Super Admin (+ Assistant Super Admin grant) only |
| POS includes sales/cashier | Admin + BossMich + Assistant Super Admin |
| Route shell allows all `OPS_LOGIN_ROLES` onto every path | Per-route `ProtectedRoute` or page-level Navigate matching matrix |
| Planning exists (CRUD BossMich / view Admin) | Keep; add Settings tab later (Part 6) |

---

## Execution parts (one prompt each)

Reply **`continue`** (or `continue part N`) after each part is verified.

### Part 1 — RBAC foundation + nav + routing ✅

**Done when:** matrix above enforced in code; old roles migrated; nav matches; e2e role smoke green.

- [x] Add role `assistant_super_admin` (Assistant Super Admin — not a person name)
- [x] Add `permission_grants` (jsonb) + BossMich UI to edit Assistant Super Admin grants (People)
- [x] Multi-branch for Admin: `staff_branch_assignments` + `getBranchScopeList(profile)`
- [x] Remove `sales` / `cashier` from app ROLES/nav/POS; migrate existing DB rows → `admin`
- [x] Rewrite `canAccess*` / `getOperationsNav` / `redirectForRole` / `allowRoute` to match matrix
- [x] Per-route `OpsRoleGate` in `App.jsx`
- [x] Redirects: `/operations/services` → POS; `/operations/products` → POS; `/operations/sms` → CRM
- [x] Update permissions tests + `scripts/e2e-rbac-part1.mjs` + readiness (no sales account)
- [x] Gate: permissions tests + e2e-rbac-part1 + build

### Part 2 — POS shell: Services + Merch + inventory SKU rules ✅

**Done when:** no standalone Services/Merch nav; POS has tabs; Admin branch-scoped; BossMich/Assistant Super Admin full.

- [x] POS tabs: Checkout | Manage services | Manage merch / inventory
- [x] Move ServicesManage + ProductsManage into POS (lazy tabs)
- [x] Services: category, name, **no duration**, status; category ties to pay bands later
- [x] Super Admin CRUD **vehicle sizes**; TL can pick sizes on queue
- [x] Inventory: chemicals sellable; same name → shared stock; distinct SKU when needed
- [x] Loyalty award / free line on POS
- [x] Customer account creation **only** Admin/BossMich/Assistant Super Admin on payment complete (not TL walk-in create); idempotent if exists
- [x] Final checking → auto pending payment on POS
- [x] Gate: `tests/posSale.test.js` + `scripts/e2e-pos-part2.mjs` + build

### Part 3 — Queue + Dashboard filters + redo / cheat detection ✅

**Done when:** Super/Assistant Super Admin see all branches labeled; date range filters; TL redo + warnings.

- [x] Dashboard: date presets (3mo, 6mo), custom range, branch comparison (BossMich/Assistant Super Admin); TL filter own / selectable TL view rules
- [x] Queue: branch filter + label; Super CRUD all; Admin assigned branches
- [x] TL **redo** status (with audit); owner-visible
- [x] Warnings: suspicious in_progress → final_checking timing (configurable thresholds)
- [x] Multi-service single transaction on add-queue; reflects one board ticket / linked lines
- [x] Gate: `tests/queueLogic.test.js` + `scripts/e2e-queue-part3.mjs` + build

### Part 4 — Crew + My Tasks (planning assignments) ✅

**Done when:** crew add requires username; attendance tabs polished; My Tasks = planning assignments + full assignee CRUD for assigners.

- [x] Crew: add user requires username; attendance tabs (smart/complete polish)
- [x] Planning: assign card → user; appears in `/operations/my-tasks`
- [x] Assignees can update their tasks; BossMich full CRUD assignments
- [x] Gate: `tests/crewUsername.test.js` + `scripts/e2e-part4-crew-tasks.mjs` + build

### Part 5 — Finance (Xero-like lite) + auto sales

**Done when:** sales auto into finance; expenses manual; tabs; Admin scoped; quote email.

- [x] Tabs: Cashflow | Expenses | Categories | Salary/Incentives | Marketing cost | Reports
- [x] Sales from POS → finance totals automatically
- [x] Expenses manual (Admin/BossMich/Assistant Super Admin write rules)
- [x] Categories CRUD; reporting trends + filters + date range
- [x] Email quotation (Resend) for expenses/quotes — not full Xero sync (ponytail ceiling)

### Part 6 — Planning settings + Forms + Events share links

**Done when:** Planning Settings tab for labels/checklist templates; forms → planning/calendar; events shareable URL.

- [x] Planning **Settings** tab: CRUD label presets, checklist templates (Trello-like)
- [x] Forms creator (complaint + custom) → can push card to planning / calendar due
- [x] Events/meets: public **shareable link** per event

### Part 7 — CRM marketing dashboard (SMS inside) + Bookings views

**Done when:** CRM = marketing analytics + directory + SMS tab; Bookings board/table/calendar + filters.

- [x] CRM tabs: Directory | Insights (sales hrs, peak times, per branch/service) | SMS
- [x] Directory from accounts created by Admin/POS (not “add customer” primary)
- [x] Bookings: board + table + calendar; daily/weekly/monthly/yearly/range; full CRUD + branch filters

### Part 8 — KPI complete + Reports (Super only) + Audit detail + Cars masterlist

**Done when:** KPI from crew data with comparisons; Reports Super(+Assistant Super Admin); rich audit; cars CRUD for BossMich.

- [x] KPI: crew/branch/service; avg min in_progress→finish; filters; TL sales+complaints views; comparison
- [x] Reports: Super Admin only module rollup (sales, expense, KPI, …)
- [x] Audit: human detail (“deleted vehicle X”, “deducted sales ₱10,000”, …)
- [x] Super Admin CRUD master **cars** list for TL picker
- [x] Customer portal: remove “add car” as primary; cars added in-person/POS if new plate; customer can delete inactive

### Part 9 — Hardening & verify

**Done when:** full e2e role matrix + build + advisors clean for new tables.

- [x] `e2e-readiness` + new `e2e-rbac-matrix.mjs`
- [x] RLS policies for multi-branch + grants
- [x] `npm run build`; update `AUDIT_CHECKLIST` / `SYSTEM_GAPS`
- [x] Remove dead demo accounts for sales/cashier

### Full E2E (all Parts) — re-verify anytime

**Checklist:** [`E2E_CHECKLIST.md`](./E2E_CHECKLIST.md)  
**Runner:** `npm run e2e:newrequest` (= `node scripts/e2e-newrequest.mjs`)

---

## Explicit out of scope / ponytail ceilings

| Request | Decision |
|---------|----------|
| Full Xero sync | **No** — email quotes + internal finance tabs |
| GraphQL | **No** — keep PostgREST |
| Attachments on planning | Later if asked |
| Browser Playwright suite | Part 9 optional / SYSTEM_GAPS |

---

## Part 1 kickoff (next prompt)

When you reply **`continue`**, implementation starts **only Part 1**:

1. DB: `nationwide` role, `permission_grants`, multi-branch assignments, migrate sales/cashier  
2. `permissions.js` + nav + `App.jsx` guards + redirects  
3. People: BossMich edits Assistant Super Admin grants; Admin multi-branch picker  
4. Tests + e2e role smoke  

Do **not** start POS/Finance/KPI until Part 1 is verified and you say continue again.
