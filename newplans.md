# Hakum — principal product plan (hospitality ops)

**North star:** Hakum should feel like a 5-star restaurant/hotel — every returning plate is *known*, money at close of day is trustworthy, and pay is fair, explainable, and customizable without fighting the POS truth.

**Audience:** Principal fullstack implementation (Vite + React + `/api/*` + Supabase Postgres/RLS).  
**Related:** `CONTEXT.md`, `audit/` (open leftovers), existing `payroll.js` / `compensation.js` / `bacoorDailyReport.js` / `permissions.js`.

---

## 0. How to use this plan

1. Ship **one vertical slice** at a time (schema → API/RPC → UI → tests → audit note).
2. Prefer reuse over new stacks (no new BFF, GraphQL, or payroll microservice).
3. Every money figure that claims “from POS” must be reconstructible from `sales` / handoffs; overrides are audited.
4. Update `audit/completed-slices.md` + `audit/open-items.md` when a slice lands.
5. Verification bar per slice: `node --test tests/*.test.js` + `npx vite build` (+ live smoke when touching auth/RBAC).

---

## 1. Vision & success criteria

| # | Outcome | Done when |
|---|---------|-----------|
| V1 | End-of-shift close is POS-truthful + BA-overridable + SA-reviewable | BA closes day with auto cash/GCash/etc.; overrides stored with reason; SA sees POS baseline vs override |
| V2 | ASA can run monthly (and flexible) expense reporting from Finance categories | Manual category entry on Finance; not forced to daily close rigidity |
| V3 | Crew see their own daily + monthly earnings in the Floor portal | Staff “My pay” / income view shows day + month from confirmed payroll + clear estimates |
| V4 | Payroll supports daily / weekly / monthly / custom range with add/deduct | Wizard period modes work; wash-pool + fixed + custom lines; deductions/additions stick through confirm |
| V5 | Compensation is role-aware and SA-customizable | Crew/TL sale-linked pools; SA/BA/marketing/etc. fixed or custom packages; no silent hardcodes |
| V6 | Roles & branch RBAC stay honest | `video_editor` already exists — polish; SA can define **custom roles** (or grant templates) + optional branch; assignees see only their work/pay |
| V7 | “Known guest” notes on queue tickets | TL sees/adds notes by customer/plate when creating/editing tickets; history of likes/dislikes/complaints |
| V8 | Hospitality feel end-to-end | Notes, preferences, and prior complaints surface in the moments staff need them — not a buried CRM tab only |

---

## 2. Current state (do not rebuild)

### Already in production / codebase

| Area | What exists | Gap vs this plan |
|------|-------------|------------------|
| Roles | `video_editor` in `ROLES`, People, demos, planner | No **custom** SA-defined roles; branch optional already via assignments |
| Daily close math | `bacoorDailyReport.js` + POS buckets (cash/GCash/CC, wash/ceramic/PPF, etc.) | Not a first-class **end-of-shift submission** with override + SA review workflow |
| Expenses | Finance expenses + categories; BA POS expense tab | ASA monthly expense *report* UX not productized; not tied to shift close |
| Payroll | `payroll.js`: daily/weekly/biweekly/monthly windows; POS-proofed preview; wash pool; confirm → Finance | Custom date range UI weak; add/deduct UX + fixed packages for non-crew roles incomplete; crew portal “income” is estimate-heavy |
| Compensation | `compensation.js` wash pool + ceramic drafts; SA settings | Need clearer per-role packages (fixed vs pool vs hybrid) editable by SA |
| CRM / queue | Customers, vehicles, complaints inbox, booking denorm | No durable **guest preference / plate notes** on ticket create |
| Audit leftovers | FK/InitPlan/permissive RLS closed | OPT-01/02/03/05/08 still open (see §8) |

### Intentional constraints (keep)

- Wash-pool salary **posts only from Payroll confirm** (Crew tab estimate-only) — see `CONTEXT.md` / `intentional-by-design.md`.
- Branch Admin has POS + floor watch; **no** Finance nav / Inventory catalog write (RLS aligned Slice U).
- Public homepage cards stay static until OPT-01 (CMS) is explicitly scheduled.

---

## 3. Workstreams (implementation order)

Ship in this order unless a dependency forces a swap.

```
W1 End-of-shift close  →  W2 Payroll & packages  →  W3 Crew income portal
W4 Guest notes (queue+CRM)  →  W5 Custom roles / RBAC polish
W6 ASA expense reporting  →  W7 Hospitality polish + audit OPTs
```

---

## 4. Workstream detail

### W1 — Branch Admin end-of-shift (POS-truthful close)

**Job:** At end of day, BA submits a shift report: payment mix, sales buckets, expenses, cash left — **auto from POS**, overridable, SA-reviewable.

#### Product rules

1. **Baseline = POS only** — paid `sales` for branch+Manila day (+ linked expenses/CA already used by `buildBacoorDailyReport`).
2. BA may **override** any money field; must enter a **reason** per overridden field (or one reason covering a set).
3. Store both: `pos_baseline_json` (immutable snapshot) and `submitted_json` (what BA attested).
4. SA (and ASA with `finance_view` or new `shift_close_review` grant) can **Review**: Accept / Request changes / Lock.
5. After Accept/Lock, overrides cannot silently rewrite POS; Finance/payroll that consume “close day” use **accepted** report, with link back to POS proof.
6. SA configures which fields appear, labels, and whether override is allowed (`shift_close_templates` or `app_settings` key) — fully customizable.

#### Data (proposed)

| Table / object | Purpose |
|----------------|---------|
| `shift_close_reports` | `id`, `branch`, `business_date`, `status` (`draft`/`submitted`/`accepted`/`rejected`/`locked`), `pos_baseline`, `submitted`, `override_reasons`, `submitted_by`, `reviewed_by`, `reviewed_at`, timestamps |
| `shift_close_field_config` | SA-editable field keys, labels, `allow_override`, sort, active |
| Audit log rows | `shift_close.submit` / `.override` / `.review` |

#### UI

| Surface | Who | Behavior |
|---------|-----|----------|
| POS or Operations → **End of shift** | BA | Load auto report → edit overrides → submit |
| Finance / Console → **Shift reviews** | SA / ASA grant | Diff POS vs submitted; accept/reject |
| Print/share | BA | Reuse `formatBacoorReportText` style output |

#### API / RLS

- Read/write scoped by `user_has_branch_access(branch)`.
- BA: insert/update own branch drafts + submit.
- SA/ASA: review all (or grant-scoped).
- Never let client invent baseline: server recomputes POS snapshot on submit and stores it.

#### Tests

- Pure: baseline builder matches `buildBacoorDailyReport` for a fixture day.
- Source-scan: submit path stores baseline ≠ submitted when override present.
- Permission: BA cannot accept; SA can.

#### Slice checklist

- [ ] Migration + RLS
- [ ] Server recompute baseline on submit
- [ ] BA UI
- [ ] SA review UI + field config
- [ ] Audit events
- [ ] Tests + audit docs

---

### W2 — Payroll: periods, packages, add/deduct (reliable + customizable)

**Job:** Payroll is the system of record for what people earn; it must support daily/weekly/monthly/**custom range**, sale-linked crew pay, and fixed/custom packages for other roles — with explicit additions/deductions.

#### Product rules

1. Period modes: **daily | weekly | biweekly | monthly | custom** (`period_start`/`period_end` free when custom).
2. **Crew / TL (wash family):** default from wash-pool / attendance rules already in `compensation.js` + `payroll.js`; SA can override line amounts.
3. **Other roles (SA, BA, marketing, video, investor pay if any, etc.):** package type per staff profile or compensation settings:
   - `fixed` (salary per period)
   - `custom` (manual lines each run)
   - `hybrid` (fixed + commissions/add-ons)
4. Every run supports **additions** and **deductions** (named, signed minor units) that survive confirm and show on My pay.
5. Confirm remains atomic (existing advisory lock / unique sale linkage) — do not regress Slice J concurrency.
6. Preview must show: POS proof total → pool/package math → edits → net per person.

#### Data (proposed)

| Change | Purpose |
|--------|---------|
| Extend `payroll_runs` | `period_mode` including `custom`; keep start/end |
| `staff_pay_packages` | `staff_id`, `package_kind`, `amount_minor`, `currency`, `effective_from`, notes; SA CRUD |
| `payroll_run_line_adjustments` | `line_id`, `kind` (`add`/`deduct`), `label`, `amount_minor` |
| Or embed adjustments JSON on `payroll_run_lines` | Ponytail: prefer columns if queried; JSON if rare |

#### UI

| Surface | Who |
|---------|-----|
| Payroll wizard — Period step | SA / ASA `finance_write` — add Custom range |
| Payroll — Packages tab / People pay section | SA — edit packages |
| Lines step | Add/deduct rows per employee; show net |
| My pay | Show base + adjustments + period |

#### Tests

- `payrollPeriodRange('custom', …)` / custom window filters sales+attendance.
- Package fixed line appears even with zero wash sales.
- Deduct reduces net; confirm persists.

#### Slice checklist

- [ ] Custom range in wizard + engine
- [ ] Packages schema + SA UI
- [ ] Add/deduct on lines
- [ ] Confirm + My pay show adjustments
- [ ] Concurrency guards still green
- [ ] Tests + audit docs

---

### W3 — Car wash crew income (daily + monthly) on portal

**Job:** Crew open the Floor app and see **today** and **this month** income clearly — without implying unpaid estimates are “paid.”

#### Product rules

1. **Confirmed / paid payroll lines** = official income (primary).
2. **Estimate** (live wash pool share for today) = clearly labeled “Estimate — not paid until Payroll confirm.”
3. Views: **Today** | **This month** | (optional) last confirmed period.
4. Detailer / TL may share similar widgets if their pay rules differ — same shell, different formula.

#### UI

- Staff home / My pay: cards for Daily / Monthly.
- Tap-through to line items + adjustments (from W2).

#### Tests

- Estimate vs confirmed copy cannot be confused (source-scan or unit on labels).
- Month aggregation uses Manila calendar.

#### Slice checklist

- [ ] Data selectors (confirmed lines + optional estimate)
- [ ] Floor UI
- [ ] Empty states
- [ ] Tests + audit docs

---

### W4 — Guest notes (“known like a regular”)

**Job:** When TL (or queue editors) create/edit a ticket for a plate/customer, they see prior notes and can add new ones — likes, dislikes, prior complaints, service prefs.

#### Product rules

1. Notes attach to **customer** (preferred) and optionally mirror **plate/vehicle** for walk-ins before CRM link.
2. Types: `preference` | `dislike` | `service` | `complaint_ref` | `general`.
3. Queue ticket modal shows **last N notes** + “Add note” (required fields: body; optional type).
4. Complaints inbox items can “promote” into a customer note (link `complaint_id`).
5. Visible to roles that work the floor: TL, BA, SA, ASA(+queue), Sales (read), Marketing (read); crew **assigned** to ticket may read.
6. Never show notes on public queue kiosk.

#### Data (proposed)

| Table | Columns (core) |
|-------|----------------|
| `customer_notes` | `id`, `customer_id`, `vehicle_id` nullable, `plate_normalized` nullable, `note_type`, `body`, `complaint_id` nullable, `created_by`, `created_at`, `is_archived` |

Indexes: `(customer_id, created_at desc)`, `(plate_normalized, created_at desc)` partial.

#### UI

- Queue ticket create/edit: Notes panel.
- CRM customer drawer: full note history + add.
- Optional badge on plate search: “Has notes”.

#### RLS

- Staff with queue/CRM access; customers never read others’ staff notes.

#### Tests

- Note creates with plate-only then attaches when customer linked.
- Public queue pages have no note queries.

#### Slice checklist

- [ ] Migration + RLS + indexes
- [ ] Queue UI
- [ ] CRM UI
- [ ] Complaint → note
- [ ] Tests + audit docs

---

### W5 — Roles: video editor + SA-created roles / RBAC

**Job:** Keep `video_editor` solid; let SA create **custom roles** (or role templates) with optional branch and narrow capabilities (tasks + pay only, etc.).

#### Reality check

- `video_editor` **already exists** (People, demos, planner, floor roster). Slice = polish + docs, not greenfield.
- Full dynamic Postgres `profile_role` enum expansion is painful; prefer one of:

**Option A (recommended, ponytail):** `staff_profiles.custom_role_key` + `role_definitions` table (label, base_template, grants JSON, default_home, shell). Runtime permissions merge template + grants. Enum stays a small set of *system* roles; custom roles map to nearest system baseline (`staff` / `marketing` / …) + grant overlay.

**Option B (heavier):** migrate `profile_role` to text + check constraint; larger blast radius.

#### Product rules

1. SA creates role definition: name, description, base template, grant toggles, optional default branch policy (`required` / `optional` / `all`).
2. Assign staff → definition; People UI lists custom roles.
3. Capability examples: planner assignee-only, My pay only, no POS, no CRM.
4. ASA may manage people only with `people` (+ `rbac_edit` for definitions if desired).

#### Slice checklist

- [ ] Decide A vs B (default A)
- [ ] `role_definitions` + assignment
- [ ] People UI create/assign
- [ ] Permission resolver uses definitions
- [ ] Video editor QA matrix pass
- [ ] Tests + `audit/roles-users.md` refresh

---

### W6 — ASA expense reporting (monthly / flexible, Finance categories)

**Job:** ASA enters expense reports by **Finance categories** on a monthly (or custom) basis — manual, not chained to BA daily close.

#### Product rules

1. Lives under **Finance** (ASA needs `finance_write` or dedicated `expense_report` grant).
2. Period: month default; allow custom range.
3. Lines: category (from `expense_categories`), amount, notes, receipt optional (storage later).
4. Distinct from BA shift-close expenses (those stay daily operational).
5. Can post into `expenses` as `pending_approval` / `approved` using existing status machine where possible.
6. SA can review/approve; reports list filterable by period/category.

#### UI

- Finance → **Expense reports** tab: list + composer.
- Category picker from live categories.
- Export CSV optional (phase 2).

#### Slice checklist

- [ ] Composer + list
- [ ] Post to expenses / link report header table if multi-line
- [ ] Permissions
- [ ] Tests + audit docs

---

### W7 — Hospitality polish + remaining audit OPTs

Not all are “features”; some are ops hygiene from `audit/open-items.md`.

| ID | Item | Owner action |
|----|------|--------------|
| OPT-01 | Homepage CMS for hero/cards | Product decision; else keep static intentional |
| OPT-02 | Duplicate repo migration prefixes | Docs-only rename policy |
| OPT-03 | Orphan `branch_operating_hours` migration row | Ops note; do not drop blindly |
| OPT-05 | Auth leaked-password protection | Enable in Supabase Auth dashboard |
| OPT-08 | ~101 unused_index INFO | Drop only with sustained `pg_stat_user_indexes` proof |
| UX | Empty states, microcopy, note prompts on ticket | “Welcome back” style when notes exist |
| UX | Shift close celebration / clear “day locked” | BA confidence |

---

## 5. Cross-cutting requirements (every workstream)

### Auth / RBAC

- Match **route gate + API + RLS** (lesson from audit B-03…B-40).
- New grants to consider: `shift_close_review`, `expense_report` (or fold into `finance_*`).
- Update `audit/roles-users.md` whenever roles/grants change.

### Money & integrity

- Minor units everywhere; Manila calendar for “day/month.”
- POS baseline recomputed server-side.
- Payroll confirm stays transactional; no double-pay sales (`payroll_run_sales` uniqueness).

### Observability

- Audit log for: shift submit/override/review, payroll confirm, package changes, role definition changes, note create/archive.

### Testing

- Unit: pure money/period/note helpers.
- Source-scan: permissions + no public note leak.
- Live smoke when touching login/roles.

### Frontend design (ops surfaces)

- Not a marketing redesign: keep Hakum ops chrome.
- One job per screen: Close day / Review close / Payroll period / Guest notes.
- Copy: “POS baseline”, “Your override”, “Estimate — unpaid”, “Confirmed pay”.

---

## 6. Suggested delivery milestones

| Milestone | Workstreams | Outcome |
|-----------|-------------|---------|
| **M1** | W1 | BA end-of-shift live; SA can review |
| **M2** | W2 + W3 | Custom payroll + crew daily/monthly income |
| **M3** | W4 | Known-guest notes on queue + CRM |
| **M4** | W5 + W6 | Custom roles polish + ASA expense reports |
| **M5** | W7 | Hospitality UX + OPT-05/08 as needed |

Each milestone = shippable on `main` with tests green and audit updated.

---

## 7. Explicit non-goals (this plan)

- Replacing Supabase Auth or inventing a new payroll vendor.
- Public kiosk showing customer private notes.
- Letting BA rewrite historical POS `sales` rows via close override (override is attestation, not POS mutation).
- Auto-paying crew from live pool without Payroll confirm.
- Full homepage CMS unless OPT-01 is pulled into a milestone.

---

## 8. Remaining changes checklist (master)

Use as a living tick list.

### Product / engineering

- [x] **W1.1** `shift_close_reports` + field config + RLS
- [x] **W1.2** Server POS baseline recompute on submit
- [x] **W1.3** BA End-of-shift UI (auto + override + reason)
- [x] **W1.4** SA review UI (diff + accept/reject/lock)
- [x] **W1.5** SA field customization
- [x] **W2.1** Payroll custom date range
- [x] **W2.2** Staff pay packages (fixed/custom/hybrid)
- [x] **W2.3** Line add/deduct with labels
- [x] **W2.4** Confirm + My pay show adjustments
- [x] **W3.1** Crew daily income card
- [x] **W3.2** Crew monthly income card
- [x] **W3.3** Estimate vs confirmed labeling
- [x] **W4.1** `customer_notes` table + indexes + RLS
- [x] **W4.2** Queue ticket notes panel
- [x] **W4.3** CRM notes history
- [x] **W4.4** Complaint → note link
- [x] **W5.1** Confirm video_editor coverage in QA matrix
- [x] **W5.2** Role definitions (custom roles) + People UI
- [x] **W5.3** Permission resolver + branch optional rules
- [x] **W6.1** ASA expense report composer (categories)
- [x] **W6.2** Monthly/custom period list + post to expenses
- [x] **W6.3** SA approve path

### Audit / ops leftovers

- [ ] **OPT-05** Enable leaked-password protection (dashboard) — cannot enable via MCP; enable in Supabase Auth settings
- [ ] **OPT-08** Unused index triage (stats-backed only) — do not mass-drop; needs pg_stat proof
- [ ] **OPT-01** Homepage CMS (product call)
- [ ] **OPT-02 / OPT-03** Migration hygiene docs
- [x] Refresh `audit/roles-users.md` after W5

### Hospitality feel

- [x] Note prompts / “regular” badge on plate search
- [x] Warm empty states on My pay and shift close
- [x] Staff-facing copy pass (no internal jargon on Floor UI)

---

## 9. Open decisions (resolve before or during M1–M2)

1. Shift close: new grant vs reuse `finance_view` for SA review?
2. Custom roles: Option A (definitions + template) vs B (text roles)? **Default A.**
3. Crew monthly income: calendar month vs last confirmed payroll month? **Default: calendar month of confirmed lines + separate estimate for current month.**
4. Should Sales role submit shift close or only BA? **Default: BA only.**
5. ASA expense reports: separate header table vs direct `expenses` rows? **Default: header + lines, post to `expenses` on submit.**

---

## 10. Original brief (preserved)

> End of shift for branch admin — sales report, expenses, cash left, GCash, etc.; auto from POS; override allowed; SA reviews against POS.  
> ASA expense report monthly (flexible) — manual by Finance category.  
> Car wash crew: monthly + daily income on portal.  
> Payroll: daily/weekly/monthly/custom; deduct/add; sale-based crew/TL; fixed/custom for other roles; reliable.  
> Video editor role (exists) + SA-created roles with optional branch / task-scoped RBAC.  
> TL ticket notes by person/plate — likes, dislikes, prior issues.  
> Goal: 5-star hospitality — guests feel known and at home.

---

*Last revised: 2026-08-21 — principal plan from `newplans.md` + audit leftovers + current payroll/POS/roles inventory.*
