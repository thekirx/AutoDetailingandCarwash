# Daily operations + user pages — evidence map (2026-10-16)

**Scope:** Shop-day routes (runbook) and customer account surfaces.  
**Companion:** [`READINESS-GAP-2026-10-16.md`](./READINESS-GAP-2026-10-16.md) · [`SHOP-DAY-RUNBOOK.md`](./SHOP-DAY-RUNBOOK.md)

Legend: **Load** = nav-walk / role-wave opens without 4xx · **Deep** = mutating or money/content proof · **Guide** = `docs/guides/pages/*`

---

## Shop-day path (daily operations)

| Step | Page | Roles | Guide | Load | Deep | Notes |
|------|------|-------|-------|------|------|-------|
| C1 Book / walk-in | `/book`, `/signup`, queue walk-in | Guest / TL | customer-app, queue | PASS | PASS history **10/10** | History sentence on signup proven API/DB |
| C1b Detailing confirm | `/operations/bookings` | TL | bookings-maintenance | PASS nav | Partial | Board load proven; full ceramic enroll→Arrive not walked this week |
| C1c Maintenance arrive | `/operations/bookings?stage=maintenance` | TL/BA | bookings-maintenance | PASS nav | **PASS Arrive 7/7** | API arrive → waiting + 409 duplicate; transfer still moves open rows |
| A1 Time-in | `/operations/attendance` | Crew / TL / BA | attendance | PASS | Prior geo unit + FLOPS A1 | Not re-mutated today |
| W1 Queue | `/operations/queue` | TL | queue | PASS | DB probe 19/19 | |
| W1b POS pay | `/operations/pos` | BA | pos | PASS | sheet money 38/38 · voice 13/13 | |
| D1 Daily sheet | POS › Daily sheet | BA | pos / daily-sheet README | PASS | **38/38** | |
| D2 Approve | Finance › Daily sheets | SA/ASA | finance-reports | PASS | **38/38** · SoD 4/4 | Push to phones **0 enrolled** |
| Books | Finance P&L / Floor Board | SA/ASA/Investor | floor-board, finance | PASS | September 60/60 | |

### Other daily ops pages (not every shop-day, but floor-adjacent)

| Page | Guide | Load | Deep gap |
|------|-------|------|----------|
| `/operations/dashboard` Floor Board | floor-board | PASS | Money depth built; green with September |
| `/operations/inventory` | inventory | PASS | Stock mutations not re-run today |
| `/operations/crm` | crm-sms | PASS | Profile dialog unit + prior nav |
| `/operations/reviews` | (thin) | PASS | Thumbs→GBP link needs URLs set |
| `/operations/planning` | planning | PASS | Forms/calendar load; task CRUD not this week |
| `/operations/my-tasks` | planning | PASS | Crew/detailer load |
| `/operations/kpi` | crew-kpi | PASS | Read-only |
| `/operations/history` | audit-history | PASS | |
| `/operations/audit` | audit-history | PASS | |
| `/operations/notifications` | notifications | PASS | Templates; real push enroll open |
| `/operations/memberships` | (via CRM/loyalty) | PASS | |
| `/operations/people` | people-roles | PASS | Hire/coming-soon |
| `/operations/branches` | branches | PASS | |
| `/operations/cars` | cars | PASS | Catalog only — not ownership |
| `/operations/vehicle-transfer` | **vehicle-transfer** | PASS nav | **Write 10/10** live e2e |
| `/operations/settings` (+ daily-sheet rules) | settings | PASS | |
| `/operations/content` | console | PASS | |
| `/operations/inquiries` | — | PASS | |
| `/operations/data-center` | — | PASS (SA) | |

Nav-walk stamp: **87/87** (2026-10-15) · Role-wave **179/179**.

---

## Customer user features / pages

| Route | In guide? | Load / responsive | Deep |
|-------|-----------|-------------------|------|
| `/signin`, `/signup` | customer-app | PASS ui-p0 / responsive | Signup history **10/10** |
| `/account` home | customer-app | PASS responsive | History banner **PASS 4/4** (UI + API); Strict Mode clear-during-render fixed |
| `/account/book` | customer-app | PASS | Catalog size fill unit |
| `/account/queue` | customer-app | PASS | Live queue |
| `/account/loyalty` | customer-app | PASS | Points seeded |
| `/account/blog`, `/events` | customer-app | PASS | Content |
| `/account/more` | customer-app | PASS | Theme / alerts |
| `/account/visit`, `/account/visit/:id` | **was missing from route list** | Prior role-qa | Visit progress |
| `/account/set-password` | AUTH-SMTP | — | **SMTP Gate OPEN** |

Must never see ops — role-wave deny packs green.

---

## Untested / thin for “ready for using” (pages focus)

1. Maintenance **Arrive** end-to-end on a due ceramic/PPF plate (SMS depends on BusyBee).  
2. Customer **Enable alerts** + staff push on real devices.  
3. Forgot-password → set-password with real inbox.  
4. Browser assertion that account home shows “You have existing history with us.” after signup.  
5. Reviews page with empty `google_review_url` (product config, not code).  
6. Inventory stock adjust / receiving on a live day (nav only recently).

---

## Optimized / functional?

| Area | Ready for daily use? |
|------|----------------------|
| TL queue → BA POS → Daily sheet → SA approve | **Yes** (code + DB) |
| Walk-in signup history + sold-car transfer | **Yes** (live e2e) |
| Customer book / queue / loyalty dock | **Mostly** (load + responsive; SMTP/push open) |
| Customer status SMS from production host | **No** |
| Staff sheet alerts on phones | **No** until enroll |

**Continue** until SMS + push + SMTP close.
