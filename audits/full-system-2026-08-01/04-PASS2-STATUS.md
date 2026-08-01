## Pass 2 — toward 100% (2026-08-01)

### Closed this pass
| ID | Fix | Live |
|----|-----|------|
| ASA-M1 / finance honesty | Expenses SELECT=`finance_view`, write=`finance_write`; categories/events aligned | Applied |
| ASA queue_all on booking-status | `canStaffUpdateBookingStatus` + loads `permission_grants` | Code |
| CUST-H9 friction | Honeypot + min dwell on contact/complaints/events | Code |
| Rate limits | public-book, signup, notify-booking, busybee (in-memory; Upstash still open) | Code |
| Index hygiene | Drop overlapping floor/events/expenses indexes; `sms_events_created_at_idx` | Applied via SQL |

### Still needs YOU to continue (ops — cannot 100% in code alone)
1. **Supabase Auth SMTP** — Dashboard → Auth → SMTP (custom domain + templates)
2. **BusyBee IP whitelist / API host** — confirm BrandTxT host + cloud egress policy
3. **Vercel env parity** — `BUSYBEE_*`, `SUPABASE_SERVICE_ROLE_KEY`, VAPID, Resend
4. **Upstash** (optional) — replace in-memory `rateLimit` for multi-instance
5. **Manual soft-launch walkthrough** — check boxes in `01-READYNESS-CHECKLIST.md` with live clicks

### Honest readiness
- **Code/RBAC/DB soft-launch:** ~95%
- **Principal 100% (ops+E2E+observability):** blocked on items 1–3 above

Reply **continue** after SMTP + BusyBee + Vercel secrets are done (or paste confirmation), and we close the remaining checklist.
