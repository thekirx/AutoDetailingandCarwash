# 25 Oct shop notes — handoff

For the next developer. Source notes: `NewChanges.md`. The living checklist is `docs/plans/2026-10-25-new-changes-checklist.md`. Every line in the notes is listed below as **Shipped** or **Kept**.

Live database: `lybxhpzzqqyqswvuwpxv`. Unit suite at the last product commit: 2447 passed, 0 failed. These screens were not clicked in a browser.

## Commits

| Commit | What it did |
|---|---|
| `b125565` | Cash-advance balance, payslips, visit rewards on screen, restock approval, Floor Board renamed to Floor Insight, bills and profit-and-loss lines, attendance headcount, POS points, voucher at checkout |
| `1b7ea83` | Coffee drinks stay separate from coffee stock. Point-shop merch. Cash-advance ask on My advances. Register shows a reward once it is reached |
| `f8b7b95` | Customer text at visits 6, 12, 18, 24, and 30. The old 4th-visit and 10th-visit stamp texts are no longer sent |
| `7d7c561` | First handoff. This file replaces it with the full note list |

## Shipped — every note line that the app does

1. **Cash advance on the person's page.** Every employee and crew except Super Admin can ask. My advances shows the amount still owed, the history, a partial payment, and paid up. Super Admin and Assistant Super Admin approve the request. That approval writes the code. The branch then records the cash on the Daily Sheet against that person. It is not an expense.
2. **Not the planner form.** The person types the amount and what it is for on My advances. The Daily Sheet is where the cash leaves the drawer.
3. **Queue number** on every wash, package, and detailing ticket.
4. **Team Lead notes in step 1.** The first step of a new ticket, Vehicle, has a notes box. The queue card shows the customer name and those notes, or “No notes”, so crew see them without opening the ticket.
5. **Branch Admin does not sell detailing, packages, or services.** They add merch and coffee drinks only, and only on a ticket the Team Lead already sent to payment. They cannot rewrite that ticket. If it needs a change, they tell the Team Lead.
6. **Unpaid advances for the owner.** Floor Insight lists who still owes. The POS Cash advances tab is the summary. When a name is chosen on the Daily Sheet, the remaining balance is shown before the cash is given or paid back.
7. **Cash, not drawer.** Daily Sheet labels and the close hint say cash.
8. **Optional voucher.** Team Lead can enter it on the ticket review. Branch Admin and office can enter it. Checkout has the same optional field. A walk-in with no ticket cannot use a code.
9. **Bills.** Edit opens the bill form. The strip shows a count for “For approval” and the amount “Awaiting payment”, so the owner and Super Admin can see what to approve.
10. **Profit and loss.** Click an expense account. The paid bills that make up that account open under it.
11. **Attendance.** The register reads like `Bacoor · Crew 8 of 10 · Team Lead 2 of 2 · Admin 1 of 2`. It can be filtered by role. Crew are not on a monthly salary. Monthly employees are the office and admin list on Monthly salaries.
12. **Payslips are the monthly salary section.** Half a month at a time. Amount per person. Salary plus an optional incentive. No tax. Statuses are Sent, Received, and Signed. The person e-signs with their name. Super Admin and Assistant Super Admin with finance write add the incentive. There is a table of recent posts and the person's own list at `/operations/payslips`.
13. **POS shows the customer's points** on the linked ticket, plus the visit reward already reached and the next one.
14. **Visit rewards, any car.** 6 free car freshener. 12 free coffee. 18 free premium car wash. 24 free back-to-zero add-on. 30 choose 15% off tint, ceramic coating, or PPF. The Rewards page and POS show them. A text goes out once at each of those visits.
15. **Points on the service rows that exist.** Premium car wash is not a separate row; Carwash is 1. Express Wash Package is 2. Paint Maintenance is 5. Glass Detailing is 5. Interior Detailing is 10. Nano Ceramic Tint is 10. Basic PPF Protection is 40. Ultimate PPF Protection is 50. Platinum PPF Protection is 60. Premium under Ceramic Coating is 20. Platinum under Ceramic Coating is 25. High Impact Partial under PPF is 30.
16. **The published points table, including names that are not a live service row.** Premium car wash 1, Express 2, Basic 3, Deluxe 4, Paint Maintenance 5, Paint Refresh 5, Glass cleaning 3, Headlight Restore 3, Black trims restore 3, Glass detailing 5, Glass coating 5, Classic ceramic 15, Premium ceramic 20, Platinum ceramic 25, Nano Ceramic Tint 10, Nano Ceramic Pro Tint 15, Nano Ceramic Pro Black Series Tint 20, Interior Detailing 10, Interior Deep Cleaning 5, High Impact Partial PPF 30, Basic PPF 40, Ultimate PPF 50, Platinum PPF 60. The Rewards page lists this whole table.
17. **Merch point prices.** Hakum Shirt 50, Clear Pro mug 30, Clear Pro Yellow Bag 30, Clear Pro Coffee Kit 60, Hakum Key Chain 20, Hakum Car Care Kit 50, Fusso coat spray 50, Luxury gloss spray 50, Hakum car scent 30, Air Spencer 30. A claim deducts that branch's stock and stays disabled until the branch has some.
18. **Member tier by total visits, any car.** 1–29 Hakum Basic Member. 30–69 Hakum Deluxe Member. 70–99 Hakum Premium Member. 100 or more Hakum Platinum Member.
19. **Customer app and SMS templates are written out** in `docs/notifications/CUSTOMER-TEMPLATE-REVIEW.md`. That request is done. Outbound customer status and reminders only. No owner daily SMS.
20. **Floor Board was renamed Floor Insight.** The route is still `/operations/dashboard`. Administrative crew tiles were removed from that page.
21. **Inventory is per branch.** Branch Admin requests a restock and cannot type over the current count. Super Admin approves on `/operations/approvals` before the count changes. The approval does not create a bill. Cost stays a manual finance entry.
22. **Show in POS** is a checkbox on each item. Coffee stock and chemicals stay hidden even if the box is checked. Point-only merch stays hidden until it also has a peso price.
23. **Stock categories.** Merchandise can show on POS. Coffee drinks, such as a Spanish latte, are their own POS items. Coffee stock (cups, beans, supplies) is inventory only and stays off POS. Chemicals stay off POS.
24. **Approvals.** `/operations/approvals` is the central page. Floor Insight shows how many restocks and bills are waiting, for the owner only. Assistant Super Admin can open Approvals and cannot approve a restock. Owner is BossMich. Lucy is the General Admin account Luci (`assistant@hakumautocare.com`). Robert is a second General Admin (`robert@hakumautocare.com`) with the same role, all branches, and the same grants. Both can set a stock count. Only Super Admin approves a restock.
25. **Cash label and collection.** No morning float. Cash left is the day's cash, not float plus cash.

## Kept — in the note, not what the app does

| Note said | What the app does |
|---|---|
| Newest ticket on top, and also the next car is FIFO | Oldest waiting car stays next. A new ticket goes to the bottom |
| Super Admin, Branch Admin, and ASA see unpaid advances on Floor Insight | Owner sees that list on Floor Insight. Branch Admin and ASA use the POS Cash advances tab or the Daily Sheet. The 19 Oct access sheet does not give them Floor Insight |
| Robert approves restock with the owner | Robert’s account is General Admin, the same role as Lucy. He can set a stock count. He opens Approvals and cannot approve a restock. Only Super Admin approves a restock |
| Each coffee sale deducts one cup and 20 grams of beans, and the coffee menu shows cups and beans left | A drink does not deduct coffee stock. The remaining-cups and remaining-grams line on the coffee menu was removed with that deduction. Coffee stock is counted on the branch inventory page only |
| The register adds the free visit reward as a line | The branch hands the gift. POS shows the reward. The sale total stays the money that was paid |

## Not verified in a browser

Queue, Team Lead step 1 notes, POS voucher, cash-advance ask, payslip sign, bills edit, profit-and-loss click, Show in POS, restock approval, Floor Insight waiting count, and the points shop were checked by unit tests and by the live database. Nobody clicked through them in the app after this work.

## Where to look

| Concern | Path |
|---|---|
| Checklist | `docs/plans/2026-10-25-new-changes-checklist.md` |
| Stock rules | `docs/inventory/STOCK-CATEGORIES.md` |
| Every customer app and SMS template | `docs/notifications/CUSTOMER-TEMPLATE-REVIEW.md` |
| Daily Sheet math | `docs/daily-sheet/FORMULAS.md` and `src/lib/sheetFormulas.js` |
| Cash-advance balance | `src/lib/cashAdvanceBalance.js`, RPC `cash_advance_ledger` |
| Payslips | `src/lib/payslip.js`, `/operations/payslips` |
| Visit rewards and the points table | `src/lib/rewardsCatalog.js`, `server/lifecycleSms.mjs` |
| Restock approval | `supabase/migrations/20261026210000_inventory_categories.sql`, `/operations/approvals` |
