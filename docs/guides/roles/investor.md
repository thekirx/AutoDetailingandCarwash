# Investor

**Home:** `/operations/finance`  
**Shell:** CommandShell (slim)  
**Device:** Desktop / tablet  
**Access:** Read only, scoped to the branches assigned in People (`staff_branch_assignments`)

## Nav

| Item | Route | What they see |
|------|-------|---------------|
| Carwash Queue | `/operations/queue` | Read only |
| Detailing Schedule | `/operations/bookings` | Read only |
| POS | `/operations/pos` | Read only. **Today** and **Sheet history**. No checkout |
| Vouchers | `/operations/vouchers` | Read only. No create |
| Finance | `/operations/finance` | Home, Sales, Bills, P&L, Reports. View only |

Branch picker appears only when more than one branch is assigned.

## Must never see or do

Floor Board, Team Planner, People, Settings, Inventory, Attendance, checkout, Daily Sheet edit, any finance write.

## How read-only is enforced

- **UI:** `allowRoute` allows `queue`, `bookings`, `pos`, `vouchers`, `finance`, `reports` (`INVESTOR_ROUTE_KEYS`). POS renders `PosReadOnlyView`. Contract: `docs/OPS/RBAC-MATRIX.md`.
- **Database:** RLS returns only assigned-branch rows; every write RPC (`complete_pos_sale`, `send_queue_ticket_to_payment`, `save/submit/review_daily_sheet`, `transition_expense`, ...) rejects the role, and direct updates on bookings, sales, expenses, staff and branches affect 0 rows. Staff names on sheets come from `staff_display_names` (assigned branch only).
- **Server:** no `/api/*` endpoint allows the investor role.

## Accounts

New investors: People → New person → role Investor (Super Admin only) → pick one or more branches.

Test accounts (password `$VITE_DEMO_PASSWORD_INVESTOR from .env`):

| Email | Branch |
|-------|--------|
| `investor@hakumautocare.com` | Bacoor |
| `investor2@hakumautocare.com` | Batangas |

Proof: `node scripts/check-investor-readonly.mjs` (both accounts, real DB, read-only; screenshots in `e2e-evidence/investor-readonly/`).
