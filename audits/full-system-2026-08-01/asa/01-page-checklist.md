# ASA — page checklist — 2026-08-01

Live session with representative grants (default + toggled off). Compare UI deny vs RPC deny.

---

## `/operations/login` — Partial (OPS-M3)

- [ ] Loads
- [ ] Sign-in CTA
- [ ] Validation
- [ ] Errors surfaced
- [ ] Scope N/A
- [ ] Dead buttons none
- [ ] Mobile
- [ ] Forgot-password (OPS-M3)

## `/operations/console` — Partial (SA-M4/M5 shared)

- [ ] Loads within ASA branch scope
- [ ] Branch picker when `branches_all` (ASA-H4 Fixed)
- [ ] Errors surfaced
- [ ] Fail-closed empty assignments
- [ ] Mobile

## `/operations/planning` — Ready (viewer)

- [ ] Loads read-only without `planning_edit`
- [ ] Edit CTAs hidden/disabled without grant
- [ ] With `planning_edit`: writes work + RLS
- [ ] Errors surfaced
- [ ] Mobile

## `/operations/people` — Ready (grant-gated)

- [ ] Loads when `people` true
- [ ] Hidden/denied when `people` false
- [ ] Cannot create Admin/ASA
- [ ] `rbac_edit` required to change grants
- [ ] Cannot mutate peer ASA/Admin (ASA-H3)
- [ ] Mobile

## `/operations/branches` — Ready (grant-gated)

- [ ] CRUD when `branches` true
- [ ] Denied when false
- [ ] Mobile

## `/operations/cars` — No (denied)

- [ ] Route gated / redirected
- [ ] No nav item
- [ ] Direct URL blocked

## `/operations/data-center` — No (denied)

- [ ] Route gated
- [ ] No nav item

## `/operations/audit` — Ready (grant)

- [ ] Loads with `audit`
- [ ] Denied without
- [ ] Mobile

## `/operations/dashboard` — Partial

- [ ] Loads in scope
- [ ] CTAs to floor
- [ ] Errors surfaced
- [ ] Mobile

## `/operations/queue` — Ready (+ redo Yes)

- [ ] View + edit with `queue_all`
- [ ] RPC assign honors `queue_all` (ASA-H1)
- [ ] Mark redo available for ASA
- [ ] Errors surfaced
- [ ] Mobile

## `/operations/queue/new` — Ready

- [ ] Create when queue edit allowed
- [ ] Validation / provision
- [ ] Errors surfaced
- [ ] DB-P0-1 concurrency risk noted
- [ ] Mobile

## `/operations/queue/:id` — Ready

- [ ] Ticket actions
- [ ] Errors without unmount
- [ ] Mobile

## `/operations/crew` — Partial

- [ ] Loads; branch pick uses `canSeeAllBranches`
- [ ] Attendance CTAs
- [ ] Geo / temp pwd gaps
- [ ] Mobile

## `/operations/kpi` — Ready

- [ ] `kpi_all` filter works (ASA-H6)
- [ ] Scoped when false
- [ ] Mobile

## `/operations/my-tasks` — Ready

- [ ] Loads / complete CTAs
- [ ] Mobile

## `/operations/pos` — Ready UI / Partial honesty

- [ ] Nav/route follows `pos` grant
- [ ] Complete sale CTA
- [ ] **RPC still allows when grant false?** — expect FAIL (ASA-M2)
- [ ] Validation / errors
- [ ] Mobile

## `/operations/finance` — Ready view / Partial write honesty

- [ ] Visible with `finance_view`
- [ ] Mutations require `finance_write` in UI
- [ ] **RLS honors finance_write?** — expect FAIL (ASA-M1)
- [ ] Empty scope fail-closed (ASA-C2 Fixed)
- [ ] Mobile

## `/operations/crm` — Ready (intentional ungated ASA-M3)

- [ ] Directory / Insights / SMS
- [ ] Errors surfaced
- [ ] Mobile

## `/operations/bookings` — Ready (ASA-M3)

- [ ] Board loads
- [ ] Create/move in scope
- [ ] Mobile

## `/operations/reports` — Partial honesty

- [ ] Nav follows `reports` grant
- [ ] Data queries honor grant server-side — **OPEN ASA-P0-1**
- [ ] Silent errors — RPT-P0-1
- [ ] Mobile

## `/operations/memberships` — Ready (grant)

- [ ] Loads with `memberships`
- [ ] Save CTAs
- [ ] Mobile
