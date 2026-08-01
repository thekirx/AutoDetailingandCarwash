# Marketing — page checklist — 2026-08-01

---

## `/operations/login` — Partial (OPS-M3)

- [ ] Sign-in → CRM
- [ ] Validation / errors / mobile

## `/operations/crm` — Partial (events/push deferred)

### Directory
- [ ] Loads customers via branch bookings (MKT-C3 Fixed)
- [ ] Register account **hidden** (MKT-H4)
- [ ] Customer update requires `role = customer` (MKT-H9)
- [ ] Vehicles branch-aware (MKT-H5)
- [ ] Errors surfaced
- [ ] Mobile

### Insights
- [ ] Branch sales peaks load (MKT-H3)
- [ ] Errors surfaced
- [ ] Mobile

### SMS
- [ ] Templates + send
- [ ] `sms_events` visible (MKT-H2)
- [ ] BusyBee GET requires bearer (MKT-H7)
- [ ] Errors / quota surfaced
- [ ] Mobile

### Deferred product surfaces
- [ ] Events management / fan-out — deferred
- [ ] Push campaigns — deferred
- [ ] Complaints / contact ops inbox — deferred

## Booking status (API, not full board)

- [ ] CRM-safe statuses only on own branch (MKT-C1)
- [ ] notify-booking not company-wide (MKT-H1)

## Denied — No

- [ ] queue / pos / finance / console / bookings board / my-tasks / people — blocked
