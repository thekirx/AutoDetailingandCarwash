# Master readiness checklist — 2026-08-01

Use this as the single **yes / no** gate. Check a box only with live evidence (screenshot, SQL row, or command output). Cross-link defects to role `02-open-defects.md` or P0 IDs in [`00-MASTER-README.md`](./00-MASTER-README.md).

**Prior context:** Role deep audits (`audits/*-deep/`) Fixed most CRITICAL bugs. This checklist is residual + launch gates.

---

## A. Soft launch (single branch)

Target: one live branch, BossMich + one TL + Staff + public book/queue.

### People & access
- [ ] BossMich can sign in at `/operations/login` and land on console
- [ ] Team Lead lands on `/operations/dashboard` with valid `branch_slug`
- [ ] Staff lands on `/operations/my-tasks` only (no other ops nav)
- [ ] Customer can `/signup` → `/account`
- [ ] Public can `/book` and see ticket on `/queue/:branch`
- [ ] Demo credentials **not** in production bundle (SA-C4 Fixed)

### Floor & money
- [ ] TL creates ticket via `/operations/queue/new` (provision OK)
- [ ] Queue status moves work without page unmount (SA-C2 Fixed)
- [ ] POS sale completes with real `service_id` (SA-H2 Fixed)
- [ ] Finance expense write stays on assigned branch
- [ ] CRM Directory shows branch customers
- [ ] Reports page surfaces query errors (today: **fail** → RPT-P0-1)

### Known soft-launch blockers
- [ ] **DB-P0-1** Queue daily number uniqueness + `assign_daily_queue_number` in git — **OPEN**
- [ ] **RPT-P0-1** Reports silent errors — **OPEN**
- [ ] **AUTH-P0-1** `getSession` hotspots reviewed/replaced — **OPEN**
- [ ] OPS-M3 ops forgot-password path accepted or fixed
- [ ] CUST-H9 spam controls on contact/complaints/events accepted or fixed

**Soft launch go?** `[ ] YES` / `[ ] NO` — default **NO** until DB-P0-1 + RPT-P0-1 cleared or signed risk acceptance.

---

## B. Multi-TL floor (same branch)

Target: two Team Leads on one branch creating/editing queue concurrently.

- [ ] Two TL sessions open on same `branch_slug`
- [ ] Simultaneous New Ticket does **not** collide on `queue_number`
- [ ] DB has `UNIQUE (branch, queue_date, queue_number)` — **OPEN (DB-P0-1)**
- [ ] `assign_daily_queue_number` (or equivalent RPC) exists in migrations **and** deployed — **OPEN / missing from git**
- [ ] Assignment sync does not double-book staff across TLs
- [ ] Realtime queue board stays consistent for both TLs
- [ ] Redo lane still denied for TL (TL-H5 Fixed)
- [ ] Empty branch TL fails closed (`NO_BRANCH_SCOPE`) — Fixed in deep audit; re-verify

**Multi-TL go?** `[ ] YES` / `[ ] NO` — default **NO** until UNIQUE + assign RPC shipped.

---

## C. ASA grant honesty

Target: every grant toggle matches route **and** RPC/RLS.

### UI gates (already mostly wired)
- [ ] `pos` false → `/operations/pos` hidden / 403
- [ ] `finance_view` false → Finance hidden
- [ ] `finance_write` false → Finance mutations disabled (default)
- [ ] `reports` false → Reports hidden
- [ ] `queue_all` false → queue edit + `sync_queue_assignments` denied (ASA-H1 Fixed)
- [ ] `people` false → provision blocked (ASA-H2 Fixed)
- [ ] `rbac_edit` false → grants not overwritten (ASA-C3 Fixed)
- [ ] `branches_all` false + no assignments → fail-closed (ASA-C1 Fixed)
- [ ] Cars / data-center still SA-only

### Honesty gaps (must clear for “ASA ready”)
- [ ] **ASA-M1** Expenses RLS honors `finance_write` (not bare `is_admin()`) — **OPEN**
- [ ] **ASA-M2** `complete_pos_sale` honors `pos` grant — **OPEN**
- [ ] **ASA-P0-1** Reports / finance / pos grants not UI-only — **OPEN**
- [ ] Planning: viewer without `planning_edit`; edit with grant
- [ ] Finance default view-only verified with write attempts

**ASA honesty go?** `[ ] YES` / `[ ] NO` — default **NO**.

---

## D. Scale — 50+ concurrent authenticated users

- [ ] Route-level code splitting (`React.lazy`) — today eager App.jsx (**PERF-P0-1 OPEN**)
- [ ] Bundle analysis: no three simultaneous ~980KB eager chunks on first ops paint
- [ ] Supabase connection / pool headroom documented
- [ ] Hot indexes present (queue, sms_events, bookings by branch+date) — see database-scale
- [ ] No overlapping redundant indexes burning write amp — reviewed
- [ ] RLS policies non-recursive (history of recursion fixed; re-verify on `staff_profiles` / grants helpers)
- [ ] Rate limits work across Vercel instances (**OPS-P0-1 OPEN** — in-memory today)
- [ ] Realtime channel count acceptable at 50 sessions
- [ ] Queue UNIQUE prevents stampede duplicates under load (DB-P0-1)

**Scale go?** `[ ] YES` / `[ ] NO` — default **NO**.

---

## E. BusyBee SMS

- [ ] BusyBee GET requires bearer (MKT-H7 Fixed)
- [ ] CRM SMS send path works for Marketing / SA / ASA with CRM
- [ ] Templates selectable on send (SA-H5 Fixed)
- [ ] `sms_events` readable under Marketing RLS (MKT-H2 Fixed)
- [ ] Provider API keys only in server env (not client)
- [ ] Quota / failure surfaced in UI (not silent)
- [ ] Provision / notify paths do not embed raw recovery `action_link` in SMS (CUST-H10 Fixed)
- [ ] Index strategy on `sms_events` reviewed (database-scale)

**BusyBee go?** `[ ] YES` / `[ ] NO` — conditional YES if keys + send verified in staging.

---

## F. SMTP / email recovery

- [ ] Supabase Auth SMTP (or provider) configured in production project
- [ ] Customer forgot-password sends for real email accounts
- [ ] **CUST-H2** phone-only / synthetic email accounts: documented product gap or fixed
- [ ] **OPS-M3** ops forgot-password → customer set-password bounce: accepted or dedicated ops path
- [ ] `/account/set-password` works with recovery session
- [ ] No recovery URLs in SMS logs

**SMTP go?** `[ ] YES` / `[ ] NO`

---

## G. Secrets & env hygiene

- [ ] `SUPABASE_SERVICE_ROLE_KEY` only on server / Vercel env — never in client bundle
- [ ] Anon key only in public client (expected)
- [ ] BusyBee / SMS provider secrets server-only
- [ ] No `.env` / credentials committed
- [ ] Vercel preview vs production env separation confirmed
- [ ] Rotation plan exists for leaked keys
- [ ] `getSession` vs `getUser` trust boundaries reviewed (**AUTH-P0-1**)

**Secrets go?** `[ ] YES` / `[ ] NO`

---

## H. Cross-cutting P0 checklist (must all be true for unconditional go)

- [ ] DB-P0-1 — UNIQUE + assign RPC in git + applied
- [ ] ASA-P0-1 — grants enforced in RPC/RLS for pos/finance/reports
- [ ] RPT-P0-1 — ReportsPage surfaces expenses/crew/comps/books errors
- [ ] PERF-P0-1 — lazy-load heavy ops routes
- [ ] OPS-P0-1 — durable rate limit store (Redis/Upstash/etc.) for Vercel
- [ ] AUTH-P0-1 — replace risky `getSession` call sites

---

## Sign-off

| Gate | Ready? | Signer | Date |
|------|--------|--------|------|
| Soft launch | [ ] | | |
| Multi-TL floor | [ ] | | |
| ASA grant honesty | [ ] | | |
| Scale 50+ | [ ] | | |
| BusyBee | [ ] | | |
| SMTP | [ ] | | |
| Secrets | [ ] | | |

**Overall:** code soft-launch **GO** (2026-08-01 pass 2–3). Production SMS/email/hosting **CONTINUE** — see [`05-CONTINUE-OPS.md`](./05-CONTINUE-OPS.md).

| Gate | Status |
|------|--------|
| Soft launch (code/DB) | **GO** — tests 74 pass; queue allocator live; lazy routes; ASA finance+pos |
| Multi-TL floor | **GO with caveat** — atomic counters live (not UNIQUE on bookings; visit groups share #) |
| ASA grant honesty | **GO for pos+finance+queue_all**; reports remains route-level |
| Scale 50+ | **Partial** — lazy done; Upstash still optional |
| BusyBee | **NO-GO** — parked host (evidence in 05-CONTINUE-OPS) |
| SMTP | **NO-GO** — needs dashboard config |
| Secrets / deploy | **NO-GO** — Hakum not linked on this Vercel team |

**Overall production:** `[ ] GO` / `[x] CONTINUE` (BusyBee + SMTP + deploy)
