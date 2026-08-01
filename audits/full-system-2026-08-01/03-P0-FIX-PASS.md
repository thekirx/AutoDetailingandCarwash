## P0 backlog — status 2026-08-01 (post-fix pass)

| ID | Status | Notes |
|----|--------|-------|
| DB-P0-1 | **Fixed + applied live** | `queue_number_counters` + integer `assign_daily_queue_number` + BEFORE INSERT trigger (no UNIQUE on bookings; visit groups share #) |
| ASA-P0-1 (pos) | **Fixed + applied live** | `asa_has_grant('pos')` enforced inside `complete_pos_sale` |
| RPT-P0-1 | **Fixed** | ReportsPage toasts expenses/crew/comps/books errors |
| PERF-P0-1 | **Fixed** | `App.jsx` React.lazy + Suspense route seams |
| AUTH-P0-1 | **Fixed** | `/book` uses `getAccessTokenFresh`; bell/settings use `getUser` |
| OPS-M7 | **Fixed** | Memberships Save column hidden for non-SA |
| OPS-P0-1 (Upstash) | **OPEN** | In-memory limits added on public-book/signup/notify/busybee; Upstash still needed for multi-instance |
| ASA finance/reports RLS | **finance Fixed live**; reports remains route-level (shared sales tables) | `20260801150000` + applied |
| CUST-H9 | **Friction Fixed** | Honeypot + dwell; CAPTCHA still optional |
| ASA queue_all booking-status | **Fixed** | Server gate loads `permission_grants` |
| Index hygiene | **Fixed live** | Dropped overlaps; `sms_events_created_at_idx` |

See also [`04-PASS2-STATUS.md`](./04-PASS2-STATUS.md).
