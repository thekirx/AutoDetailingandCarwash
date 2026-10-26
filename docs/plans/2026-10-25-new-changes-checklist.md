# NewChanges checklist

Source: `NewChanges.md` (Hakum notes, 25 Oct 2026).
Status key: **Done** means the screen and the database already agree. **Partial** means a piece exists and was not rebuilt. **Not started** means it is not in the app yet.

This file is the resume point. Update it on every pass. Do not mark a row Done without a file or a test.

## Already true — do not rebuild

| # | Note | Status | Evidence |
|---|---|---|---|
| 2 | Queue number on every wash, package, and detailing ticket | **Done** | `bookings.queue_number`, `formatQueueNumber` |
| 2b | Next car is the oldest waiting ticket. New tickets go to the bottom | **Done** | `fifoNextTicketId` in `src/queue/queueLogic.js`. The note also says “newest on top.” That reading is LIFO and fights “which car is next.” The app keeps FIFO. |
| 3 | Existing customer name is on the ticket | **Done** | Queue selects include `customer_name` |
| 4 | Notes stay on the ticket for crew and Team Lead | **Done** | `QueueTicketEditor` always shows notes, or “No notes” |
| 4 / 5 / 6 | Branch Admin does not sell detailing, packages, or services. They add sellables only, and only on a ticket the Team Lead already sent to payment. They cannot rewrite a Team Lead ticket | **Done** | `assertBranchAdminCart` in `src/lib/posSale.js`. POS opens Branch Admin on the merch tab. A live click was **not** repeated this pass |
| 7 / 14 | Optional voucher on the Team Lead ticket. Branch Admin can enter one on that ticket. POS consumes a voucher already on the ticket | **Partial** | `QueueTicketEditor` has a voucher code panel. Checkout still has the birthday code. A second optional voucher box at pay was not added |
| 8 | Finance bill edit | **Partial** | Edit opens `FinanceBillForm`. Not clicked in the browser this pass. The bills strip now shows a for-approval count and the amount awaiting payment |
| 9 | Profit and loss lines | **Partial** | An expense account on the statement opens the paid bills that make it up. Browser click **not** verified |
| 11 | Attendance line | **Done this pass** | Register reads `Crew 8 of 10 · Team Lead 2 of 2 · Admin 1 of 2` from who is present or late |
| 12 | POS shows the customer’s points | **Done this pass** | `PosPage` loads `loyalty_points` with `loyalty_stamps` and shows “N points” on the linked customer. Browser click **not** verified |
| 6 | Say cash, not drawer | **Done this pass** | Daily Sheet labels and the close hint. Internal channel names are unchanged |
| 12 | Rename Floor Board to Floor Insight | **Done this pass** | Nav label and page title. Route is still `/operations/dashboard` |
| 11 | Remove administrative crew from the floor page | **Done this pass** | The tile row is gone. Marketing, ASA, Branch Admin, and Team Lead counts are no longer on that page |

## Access conflict — do not widen silently

| Note | Conflict |
|---|---|
| SA, BA, and ASA see unpaid cash advances on the floor board | The 19 Oct sheet gives Floor Insight to Owner, Super Admin, and crew watch only. Branch Admin and ASA do not have that page. Unpaid advances for those roles need a surface they already have (POS or Daily Sheet), not a new floor-board grant |
| Approvals for Lucy, the owner, and Robert | Owner is BossMich. Lucy is whoever holds ASA. Robert is a name in the note, not a role. Do not create an account |

## Still open — continue here

Cash advance balance, bills, profit-and-loss lines, and the attendance headcount are in the table above or in item 1. The rest still need a new table.

1. **Cash advance remaining balance — done this pass.** `cash_advance_ledger` is live. The Daily Sheet shows what that person still owes when their name is chosen, including the line being typed. POS has a Cash advances tab. Floor Insight shows who still owes, for the owner only. My advances shows remaining, history, and paid up. Giving cash still needs the approval code, so the request stays. It is still not an expense. Branch Admin and ASA do not get Floor Insight; they use the POS tab or the sheet. A live click was **not** done.
2. **Payslips — done this pass, not clicked.** Office and admin pay is one half of a month. Salary plus an optional incentive. No tax. The slip is on Payslips: Sent, then Received, then signed with their name. Crew, team leads, and detailers stay on the Daily Sheet and are not in the picker. `payslips` is the table. A live sign was **not** done.
3. **Visit rewards — shown, not auto-added.** 6 free freshener, 12 free coffee, 18 free premium wash, 24 free back-to-zero, 30 choose 15% off tint, ceramic, or PPF. The customer Rewards page and the POS customer line show the next one from completed visits on any car. The register does not add the free line by itself.
4. **Points table — in the app, partly on the service rows.** The Rewards page lists every point value from the note. Exact name matches updated Glass Detailing (5), Interior Detailing (10), Nano Ceramic Tint (10), and Paint Maintenance (5). Basic / Ultimate / Platinum PPF Protection were set to 40 / 50 / 60. Express Wash Package was already 2. Carwash, Ceramic Coating, and the generic PPF row were left alone because the note names a specific tier. Merch in the note (shirt, mug, bag, coffee kit) is not in the product list yet, so those point prices are on the Rewards page only.
5. **Member tier — shown.** 1–29 Basic, 30–69 Deluxe, 70–99 Premium, 100+ Platinum, from completed visits. It is not a separate stored column.
9. **Voucher at checkout — done this pass, not clicked.** The ticket editor still has the code. POS has an optional voucher field. It applies only when the sale is a queue ticket, then charges the new ticket price. A cash and GCash split stops so the amounts can be checked. Team Lead, Branch Admin, and office can apply it. A walk-in with no ticket cannot.
10. **Notification copy — written for review.** `docs/notifications/CUSTOMER-TEMPLATE-REVIEW.md`. Outbound customer status and reminders only. No owner daily SMS. The old 4th-visit and 10th-visit texts are the stamp card, not the new visit rewards.
6. **Inventory categories — done this pass, not clicked.** Merchandise and the coffee menu can show on POS. Coffee materials and chemicals stay off it. A coffee sale takes one cup and 20 grams of beans when those materials are marked. Branch Admin requests a restock. Super Admin approves before the count changes. The approval does not create a bill. Super Admin and ASA can still set the count. `docs/inventory/STOCK-CATEGORIES.md`.
7. **POS visibility — done this pass, not clicked.** Each item has Show in POS. Coffee materials and chemicals stay hidden.
8. **Approvals — done this pass, not clicked.** `/operations/approvals` lists waiting restocks and the count of bills waiting for approval. Super Admin approves a restock. Floor Insight shows how many are waiting, for the owner only. ASA with finance or catalog can open the page and cannot approve a restock. Robert is not a role.

## Database

`cash_advance_ledger(text, uuid)` is applied on `lybxhpzzqqyqswvuwpxv` (26 Oct 2026). It does not add a table. Crew can read only their own lines. Branch Admin, Operations Lead, and ASA with POS or finance can read one branch. The owner can read all branches.

`payslips`, the points updates, the wider voucher apply, and `restock_requests` are on `lybxhpzzqqyqswvuwpxv` (26 Oct 2026). Super Admin approves a restock before the count changes. That approval does not create a bill.
