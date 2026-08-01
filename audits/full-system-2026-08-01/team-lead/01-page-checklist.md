# Team Lead — page checklist — 2026-08-01

---

## `/operations/login` — Partial (OPS-M3)

- [ ] Sign-in → dashboard
- [ ] Validation / errors / mobile
- [ ] Forgot-password path

## `/operations/dashboard` — Ready

- [ ] Loads Floor home
- [ ] CTAs to queue / crew
- [ ] Requires valid branch (setup message if empty)
- [ ] Errors surfaced
- [ ] Mobile

## `/operations/queue` — Ready

- [ ] Edit status / assign / price
- [ ] Realtime
- [ ] Mark redo **hidden** (TL-H5 / OPS-H3)
- [ ] Errors surfaced
- [ ] Mobile

## `/operations/queue/new` — Ready

- [ ] Create ticket (provision includes TL — TL-C2 Fixed)
- [ ] Validation
- [ ] Concurrent number risk **DB-P0-1**
- [ ] Mobile

## `/operations/queue/:id` — Ready

- [ ] Manage ticket
- [ ] Final check label honest (OPS-H2)
- [ ] Errors without unmount
- [ ] Mobile

## `/operations/crew` — Ready

- [ ] Attendance + add staff
- [ ] Settings tab hidden (TL-M4 Fixed)
- [ ] Branch reject `__none__` (TL-M3)
- [ ] Mobile

## `/operations/kpi` — Ready

- [ ] Own branch only (TL-C3 Fixed)
- [ ] Mobile

## `/operations/bookings` — Ready

- [ ] Scoped create/edit (TL-M1)
- [ ] booking-status API branch-gated (TL-C1)
- [ ] Mobile

## `/operations/my-tasks` — Ready

- [ ] Loads / complete
- [ ] Mobile

## Denied surfaces — No

- [ ] `/operations/pos` blocked
- [ ] console / finance / crm / people / branches / cars / reports / planning / memberships / audit blocked
- [ ] NotificationBell home ≠ console (related STF-H6 pattern for staff; TL → dashboard)

## Plate / customer search — Partial (TL-C5)

- [ ] Search usable for walk-ins
- [ ] Writes cannot update arbitrary customers (tightened)
- [ ] Broad SELECT accepted or narrowed
