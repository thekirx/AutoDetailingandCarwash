# Hakum — live workflows, DB enums, API (Graphify gap fill)

Verified 2026-09-15 against live Postgres + `src/` + `vite.config.js`. Pair with `docs/GRAPHIFY_MEMORY.md` (tables/RPCs) and `docs/OPS/MONEY-CONTRACT.md` (money law).

## Gap this file closes

The first graph pass had table *names* and docs, but not:

- Postgres enums (`booking_status`, `profile_role`)
- CHECK constraints that are the real state machines
- Queue vs Bookings *status ladders* (same enum, different UX)
- `/api/*` mounts (Vite + Vercel, not PostgREST)
- Storage buckets

## One row, two boards

`public.bookings` is both same-day Queue tickets and multi-day Detailing cards. Discriminator is `services.pay_category` via `serviceKindFromPayCategory` (`src/lib/serviceKinds.js`):

| kind | pay_category | Board | Queue number |
|------|----------------|-------|----------------|
| service | wash, general, addon | Queue | daily `assign_daily_queue_number` |
| package | package, **ppf** (legacy film bundle) | Queue | daily |
| detailing | detailing | Bookings | persistent `assign_persistent_queue_number` |

Detailing SKUs: `ceramic-coating`, `paint-maintenance`, `nano-ceramic-tint`, `paint-protection-film`. Public `/book` and `/api/public-book` are detailing-only. Wash Queue rejects detailing SKUs.

## Postgres enum `booking_status` (live)

`pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`, `waiting`, `final_checking`, `for_payment`, `redo`, `for_releasing`.

### Queue (same-day) — `src/queue/queueLogic.js`

Active floor: `waiting` → `in_progress` → `final_checking`. Ops also shows `redo`. Public kiosk uses active only.

```
pending → confirmed | waiting | cancelled
confirmed → waiting | cancelled
waiting → in_progress | cancelled
in_progress → final_checking | cancelled
final_checking → for_releasing | completed | cancelled
for_releasing → for_payment | completed | cancelled
for_payment → (empty — POS owns it via send_queue_ticket_to_payment)
redo → in_progress
completed | cancelled → terminal
```

`ACTIVE_QUEUE_STATUSES` = waiting, in_progress, final_checking.  
`WORKFLOW_STATUSES` = those + for_payment + redo.  
`REDO_FROM` = in_progress, final_checking, for_payment.  
`ADMIN_OVERRIDE_TARGET` = waiting, in_progress, final_checking (`admin_override_queue_status`).

Send to POS: `send_queue_ticket_to_payment` → `pos_handoffs` → POS pending tab → `complete_pos_sale`.

### Bookings (detailing) — `src/lib/detailingBoardStatuses.js`

```
pending (Placeholder) → confirmed (Assign to branch) → waiting (Vehicle intake)
→ in_progress → final_checking → for_releasing → for_payment → completed
```

Sales/Marketing may also set `cancelled`. Terminal for date filters: `completed`, `cancelled` (`BOOKING_TERMINAL_STATUSES`). Extra enum values `no_show` and `redo` exist in DB; Queue uses `redo`, detailing board does not list `no_show`.

Staff status writes: PostgREST + RLS, or `/api/booking-status` (`canStaffUpdateBookingStatus`). Completing detailing requires `completion_outcome` in `no_issues` | `complaints_addressed` | `unhappy`.

## Other live state machines (CHECK)

| Table | Field | Values |
|-------|--------|--------|
| sales | status | pending, paid, cancelled, refunded, voided |
| expenses | status | draft, pending_approval, approved, pending_payment, paid, posted |
| expenses | expense_kind | daily, monthly, salary_carwash, salary_detailer, salary_tinter, other_branch, cash_advance, ca_repayment, other |
| payroll_runs | run_kind | floor, fixed |
| payroll_runs | status | confirmed, paid, void |
| payroll_runs | frequency | daily, weekly, biweekly, semimonthly, monthly, custom |
| shift_close_reports | status | draft, submitted, accepted, rejected, locked |
| queue_assignments | status | active, released, cancelled |
| services | pay_category | general, wash, addon, package, ppf, detailing |

`bookings.vehicle_type` CHECK allows **both** pricing slugs (`small|medium|large|extra_large`) **and** legacy body slugs (`sedan|suv|pickup|van|motorcycle|other`). Price lookup uses `normalizePricingSize` (`src/lib/servicePricing.js`). `queueLogic.VALID_VEHICLE_TYPES` lists both sets; `normalizeVehicleType` accepts either and maps aliases (`xl`→`extra_large`). New tickets/autofill write pricing slugs.

## Role enum `profile_role` (live)

customer, staff, admin, team_lead, cashier (deprecated), BossMich, marketing, sales, assistant_super_admin, detailer, video_editor, investor, operations_lead.

App source of truth: `src/auth/permissions.js`. Do not authorize from `user_metadata`.

## Money workflow (code + RPC)

```
Queue/Bookings ticket
  → send_queue_ticket_to_payment | walk-in cart
  → complete_pos_sale (payload jsonb) → sales (paid) + sale_line_items
  → loyalty RPCs as configured
POS End of shift → submit_shift_close (status submitted)
  → Finance review_shift_close (accepted | rejected | locked)
  → notify SA/ASA
  → run_payroll floor (blocked if pending_floor_optional=false and close not accepted)
```

Payment methods (floor): `cash` | `gcash` | `card` (`src/lib/paymentMethods.js`). Legacy `online`/`bank` → card.

POS shell tabs: checkout, pending, expenses, dashboard; settings if allowed (`src/lib/posInsights.js`). BA merch + Pay queue + expenses + EoS. SA/ASA also bay + detailing walk-in.

P&L reads **paid** POS + **paid** expenses — not EoS typed totals.

## `/api/*` (Vite `attachHakumApis` + Vercel `api/`)

Not PostgREST. Session/service as each handler already does.

| Path | Purpose |
|------|---------|
| /api/provision-customer | TL/CRM create Auth+CRM |
| /api/provision-staff | People create staff Auth |
| /api/update-staff | People update |
| /api/customer-portal | Customer session helpers |
| /api/customer-signup | Public signup |
| /api/customer-auth-lookup | Demo/email lookup |
| /api/customer-history | Portal history |
| /api/public-book | Detailing public book |
| /api/public-inquiry | Contact/partnership |
| /api/plate-lookup | Public plate |
| /api/booking-status | Staff status + SMS |
| /api/maintenance-schedules | Paint maintenance |
| /api/push-subscribe, /api/send-push | Web push |
| /api/notify-booking, notify-ops-form, notify-planner, notify-pos, notify-shift-close, notify-ops-lab | In-app/push/SMS |
| /api/lifecycle-sms | Customer lifecycle SMS |
| /api/busybee | BrandTxt / BusyBee |
| /api/notification-settings, notification-broadcast, notification-broadcast-kinds, notification-templates | Comms admin |
| /api/birthday-greetings | Birthday SMS |
| /api/send-finance-quote | Quotes |
| /api/data-center | SA import/export/purge |

Floor money still goes **PostgREST RPC**, not these routes.

## Storage buckets (live)

| id | public | Used for |
|----|--------|----------|
| content-media | yes | Site/blog |
| vehicle-photos | yes | CRM/cars |
| booking-updates | no | Ticket photos |
| plan-proofs | no | Planner `{uid}/{cardId}/file` |

Upsert needs INSERT+SELECT+UPDATE on storage policies.

## Planner / Ops Lab / attendance (short)

- Planner: `plan_cards` → lists → boards; proof in `plan-proofs`; Review tab accept/send-back.
- Ops Lab: `/operations/roadmap` — `ops_lab_types` / `ops_lab_statuses` / `ops_roadmap_*`; notify via `/api/notify-ops-lab`.
- Attendance: `staff_attendance` + geofence trigger `enforce_staff_attendance_geofence`. Operations Lead has **no** clock. Floor wash pool uses bay `staff` with attendance weight > 0.

## Customer portal vs staff

Public + `/account/*` = customer JWT. `/operations/*` = staff `OPS_LOGIN_ROLES`. Kiosk `/queue/:branch` uses DEFINER views (branch, queue_number, status only).
