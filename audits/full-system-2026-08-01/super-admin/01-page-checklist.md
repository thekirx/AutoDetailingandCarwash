# Super Admin — page checklist — 2026-08-01

Check every box with a live BossMich session. Mark defects in [`02-open-defects.md`](./02-open-defects.md).

---

## `/operations/login` — Partial (OPS-M3)

- [ ] Page loads without console errors
- [ ] Primary CTA: Sign in with valid SA credentials
- [ ] Validation: empty email/password blocked
- [ ] Errors surfaced (wrong password visible)
- [ ] RLS/scope N/A
- [ ] Dead buttons: none expected
- [ ] Mobile usable
- [ ] Forgot-password path acceptable (OPS-M3 bounce) or fixed

## `/operations/console` — Partial (SA-M4 / SA-M5)

- [ ] Loads snapshot for all branches
- [ ] Primary CTAs: branch filter, drill-downs
- [ ] Validation N/A for read dashboard
- [ ] Partial errors shown (SA-H7 Fixed — regression)
- [ ] All-branch scope OK
- [ ] No dead export if advertised (SA-M5 — no export yet)
- [ ] Mobile: cards readable
- [ ] Profit window matches Finance (SA-M4)

## `/operations/planning` — Ready

- [ ] Loads board
- [ ] Create/edit cards (SA)
- [ ] Validation on assignees / dates
- [ ] Errors surfaced
- [ ] RLS: plan_* writable for SA
- [ ] No dead buttons
- [ ] Mobile / tablet board usable

## `/operations/people` — Partial (SA-M6)

- [ ] Directory loads all roles
- [ ] Provision staff / elevate ASA
- [ ] Validation on email/role/branch
- [ ] Errors surfaced
- [ ] Scope all-branch; grants editable
- [ ] Email/password edit UI (SA-M6 deferred)
- [ ] Mobile

## `/operations/branches` — Ready

- [ ] List loads
- [ ] Create / edit / archive
- [ ] Validation on slug/name
- [ ] Errors surfaced
- [ ] SA-only create OK
- [ ] No dead controls
- [ ] Mobile

## `/operations/cars` — Ready

- [ ] Catalog loads
- [ ] CRUD CTAs work
- [ ] Validation
- [ ] Errors surfaced
- [ ] SA-only gate
- [ ] No dead buttons
- [ ] Mobile

## `/operations/audit` — Ready

- [ ] Log loads
- [ ] Filters work
- [ ] Errors surfaced
- [ ] SA/ASA audit grant
- [ ] Mobile

## `/operations/data-center` — Ready

- [ ] Page loads
- [ ] Primary tools/export actions work as labeled
- [ ] Errors surfaced
- [ ] SA-only
- [ ] Mobile

## `/operations/dashboard` — Partial

- [ ] Floor dashboard loads
- [ ] Primary navigation to queue/crew
- [ ] Errors surfaced
- [ ] All-branch or picker OK
- [ ] Mobile
- [ ] Gaps documented (Partial inventory)

## `/operations/queue` — Ready

- [ ] Board loads + realtime
- [ ] Status moves / assign
- [ ] Validation on moves
- [ ] Action errors ≠ load errors (SA-C2)
- [ ] All-branch / filter
- [ ] Redo visible for SA
- [ ] Mobile

## `/operations/queue/new` — Ready

- [ ] Form loads
- [ ] Create ticket CTA
- [ ] Customer provision + plate validation
- [ ] Errors surfaced
- [ ] Number assignment (blocked by DB-P0-1 under concurrency)
- [ ] Mobile

## `/operations/queue/:id` — Ready

- [ ] Ticket loads
- [ ] Edit / handoff / price CTAs
- [ ] Validation
- [ ] Errors surfaced without unmount
- [ ] Scope OK
- [ ] Mobile

## `/operations/crew` — Partial (geo / temp pwd)

- [ ] Roster + attendance load
- [ ] Clock / add staff CTAs
- [ ] Validation
- [ ] Errors surfaced
- [ ] Geofence honesty (client-only residual)
- [ ] Temp password flows complete
- [ ] Mobile

## `/operations/kpi` — Ready

- [ ] Loads
- [ ] Branch filter (all sites)
- [ ] Errors surfaced
- [ ] RPC scope (SA-H6 Fixed)
- [ ] Mobile

## `/operations/my-tasks` — Ready

- [ ] Loads SA tasks
- [ ] Acknowledge / complete CTAs
- [ ] Errors surfaced
- [ ] Mobile
- [ ] Note SA-M7 if queue complete edge missing

## `/operations/pos` — Ready

- [ ] Loads services/merch/cart
- [ ] Complete sale CTA
- [ ] Validation (loyalty Link2 Fixed SA-C1)
- [ ] Errors surfaced
- [ ] Manila “today” (SA-H1)
- [ ] Mobile

## `/operations/finance` — Ready

- [ ] Loads
- [ ] Expense / inventory CTAs
- [ ] Validation (NaN Fixed SA-H10)
- [ ] Errors surfaced
- [ ] All-branch OK
- [ ] Mobile

## `/operations/crm` — Ready

- [ ] Directory / Insights / SMS
- [ ] Send SMS + templates (SA-H5)
- [ ] Validation
- [ ] Errors surfaced
- [ ] Mobile

## `/operations/bookings` — Ready

- [ ] Board loads + floor statuses (SA-H4)
- [ ] Create/move CTAs
- [ ] Validation
- [ ] Errors surfaced
- [ ] Mobile

## `/operations/reports` — Partial (RPT-P0-1)

- [ ] Page loads
- [ ] Primary report tabs
- [ ] Validation N/A
- [ ] **Errors surfaced** for expenses/crew/comps/books — **expected FAIL (silent .error)**
- [ ] Branch scope (SA-C3 Fixed)
- [ ] Mobile

## `/operations/memberships` — Ready

- [ ] Loads
- [ ] Save weights / plans (SA)
- [ ] Validation
- [ ] Errors surfaced
- [ ] Mobile
