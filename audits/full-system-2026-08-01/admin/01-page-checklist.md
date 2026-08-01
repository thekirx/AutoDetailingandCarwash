# Admin — page checklist — 2026-08-01

---

## `/operations/login` — Partial (OPS-M3)

- [ ] Loads / sign-in
- [ ] Validation / errors
- [ ] Mobile
- [ ] Forgot-password path

## `/operations/console` — Ready

- [ ] Loads “All my branches” picker (ADM-H1 Fixed)
- [ ] Empty assignments fail-closed
- [ ] Errors surfaced
- [ ] Mobile

## `/operations/planning` — Ready (viewer / OPS-M6)

- [ ] Loads with Viewer badge
- [ ] No edit CTAs (or disabled intentionally)
- [ ] Mobile

## `/operations/people` — Ready

- [ ] Directory filtered to scope (ADM-H3)
- [ ] TL/Staff provision only
- [ ] Validation / errors
- [ ] Mobile

## `/operations/branches` — Ready

- [ ] Edit assigned only
- [ ] Create/archive hidden (ADM-H2)
- [ ] Mobile

## `/operations/cars` — No

- [ ] No nav / direct URL blocked

## `/operations/data-center` — No

- [ ] Blocked

## `/operations/audit` — No / grant N/A

- [ ] Confirm Admin cannot open audit (unless product changed)

## `/operations/dashboard` — Ready

- [ ] Branch Admin label (ADM-M2)
- [ ] Scoped floor metrics
- [ ] Mobile

## `/operations/queue` — Ready (view)

- [ ] Board view in scope
- [ ] Status edit denied without queue edit capability
- [ ] Mark redo hidden (OPS-H3)
- [ ] Mobile

## `/operations/queue/new` — No

- [ ] Route denied (`allowRoute('queue-new')` false) — ADM-M1 Fixed
- [ ] No nav CTA

## `/operations/queue/:id` — Ready (limited)

- [ ] View ticket
- [ ] Edit panel hidden when `!canManageQueue` (OPS-H1)
- [ ] Mobile

## `/operations/crew` — Ready

- [ ] Attendance for assigned branches
- [ ] Settings geofence OK
- [ ] No SA-only role matrix
- [ ] Mobile

## `/operations/kpi` — Ready

- [ ] Own assigned branches only
- [ ] Mobile

## `/operations/my-tasks` — Ready

- [ ] Loads / CTAs
- [ ] Mobile

## `/operations/pos` — Ready

- [ ] Scoped branch pick
- [ ] Complete sale
- [ ] Validation / errors
- [ ] Mobile

## `/operations/finance` — Ready

- [ ] Write expenses in scope (ADM-C1 Fixed)
- [ ] Cannot pick foreign branches
- [ ] Mobile

## `/operations/crm` — Ready

- [ ] Directory / SMS in scope
- [ ] Mobile

## `/operations/bookings` — Ready

- [ ] Create uses scoped branches (ADM-C4)
- [ ] Mobile

## `/operations/reports` — No

- [ ] No nav / blocked

## `/operations/memberships` — Partial (OPS-M7)

- [ ] Page loads
- [ ] Weight Save: disabled but visible for non-SA — polish hide vs disable
- [ ] Other membership CTAs for Admin
- [ ] Mobile
