# Investor

**Home:** `/operations/finance`  
**Shell:** CommandShell (slim)  
**Device:** Desktop / tablet  
**Access:** Read only, scoped to the branches assigned in People (`staff_branch_assignments`)

## Nav

| Item | Route | What they see |
|------|-------|---------------|
| Floor Board | `/operations/dashboard` | Status cards (waiting, in progress, checking, for payment), paid sales, cash / online split, payment handoffs, activity log. No crew panel, no links into Queue or Bookings |
| POS | `/operations/pos` | **Today** (sales, cars waiting to pay) and **Sheet history** (Weekly / Monthly / Daily). Opening a sheet shows it in review mode with no Approve / Return |
| Finance | `/operations/finance` | Home, Sales, Bills, P&L, Reports and the other finance tabs, badge "View only". Quotes are hidden. "Open sheets" links to POS Sheet history |

Branch picker appears only when more than one branch is assigned.

## Must never see or do

Queue / Bookings / People / Settings / Inventory / Attendance (access denied), checkout, Daily Sheet edit / submit / approve, any finance write, payroll run.

## How read-only is enforced

- **UI:** `allowRoute` allows only `dashboard`, `pos`, `finance`, `reports` (`INVESTOR_ROUTE_KEYS`). POS renders `PosReadOnlyView` instead of the counter.
- **Database:** RLS returns only assigned-branch rows; every write RPC (`complete_pos_sale`, `send_queue_ticket_to_payment`, `save/submit/review_daily_sheet`, `transition_expense`, ...) rejects the role, and direct updates on bookings, sales, expenses, staff and branches affect 0 rows. Staff names on sheets come from `staff_display_names` (assigned branch only).
- **Server:** no `/api/*` endpoint allows the investor role.

## Accounts

New investors: People → New person → role Investor (Super Admin only) → pick one or more branches.

Test accounts (password `HakumInvest2026!`):

| Email | Branch |
|-------|--------|
| `investor@hakumautocare.com` | Bacoor |
| `investor2@hakumautocare.com` | Batangas |

Proof: `node scripts/check-investor-readonly.mjs` (both accounts, real DB, read-only; screenshots in `e2e-evidence/investor-readonly/`).
