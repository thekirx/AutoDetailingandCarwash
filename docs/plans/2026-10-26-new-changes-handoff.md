# 25 Oct shop notes — handoff

For the next developer. Source notes: `NewChanges.md`. The living checklist is `docs/plans/2026-10-25-new-changes-checklist.md`. This file is the summary of what shipped and what was left on purpose.

Live database: `lybxhpzzqqyqswvuwpxv`. Unit suite at the last product commit: 2447 passed, 0 failed. These screens were not clicked in a browser.

## Commits

| Commit | What it did |
|---|---|
| `b125565` | Cash-advance balance, payslips, visit rewards on screen, restock approval, Floor Insight rename, bills and profit-and-loss lines, attendance headcount, POS points, voucher at checkout |
| `1b7ea83` | Coffee drinks stay separate from coffee stock. Point-shop merch. Cash-advance ask on My advances. Register shows a reward once it is reached |
| `f8b7b95` | Customer text at visits 6, 12, 18, 24, and 30. The old 4th-visit and 10th-visit stamp texts are no longer sent |

## How the shop day works now

1. A new wash, package, or detailing ticket gets a queue number and goes to the bottom. The oldest waiting car stays next.
2. The ticket shows the customer name and the notes. Team Lead and crew both see the notes.
3. Branch Admin does not sell detailing, packages, or services. They add merch and coffee drinks only, and only on a ticket the Team Lead already sent to payment. They cannot rewrite that ticket.
4. Voucher code is optional on the Team Lead ticket and at checkout. A walk-in with no ticket cannot use one.
5. POS shows the linked customer's points, the visit reward already reached, and the next one.
6. Cash is labeled cash. There is no morning float. A ticket can split between cash and GCash. The ticket still counts once in total sales.
7. A person asks for a cash advance on My advances (amount and what it is for). That is not the planner form. After approval, the branch records the cash on the Daily Sheet. It is not an expense. Remaining, history, and paid up show on My advances, the POS Cash advances tab, and the sheet when the name is chosen.
8. Bills: edit opens the form. The strip shows a for-approval count and the amount awaiting payment.
9. Profit and loss: click an expense account to see the paid bills in it.
10. Attendance reads `Crew 8 of 10 · Team Lead 2 of 2 · Admin 1 of 2` and can be filtered by role. Administrative crew is not on Floor Insight.
11. Crew, team leads, and detailers are paid on the Daily Sheet. Office and admin pay is a half-month payslip: salary plus an optional incentive, no tax. The person marks it received and signs. Super Admin and ASA with finance write add the incentive.
12. Visit rewards, any car: 6 free car freshener, 12 free coffee, 18 free premium wash, 24 free back-to-zero, 30 choose 15% off tint, ceramic, or PPF. The branch hands the gift. Member tier is Basic, Deluxe, Premium, Platinum from completed visits.
13. The ten merch items are in the point shop at the note's point prices. A claim stays disabled until that branch has stock, then the claim deducts that stock. They stay off the register until someone sets a peso price.
14. Coffee drinks (a Spanish latte and the rest of the menu) are their own POS items. Coffee stock and chemicals stay off POS. A drink sale does not deduct cups or grams.
15. Branch Admin requests a restock. The count does not move until Super Admin approves it on `/operations/approvals`. That approval does not create a bill. Owner and Assistant Super Admin can type a corrected count.
16. Customer texts are outbound status and reminders only. No owner daily close SMS. A reward text goes out once at visits 6, 12, 18, 24, and 30.

## Left on purpose — do not rebuild these

| Note said | What the app does | Why |
|---|---|---|
| Newest ticket on top | Oldest waiting car stays next | "Which car is next" is FIFO. Newest-on-top would hide that car |
| Branch Admin and ASA see unpaid advances on Floor Insight | They see them on POS and the Daily Sheet. Floor Insight stays with the owner and crew watch | The 19 Oct access sheet does not give Branch Admin or ASA that page |
| Robert can correct stock | No Robert account. Owner and whoever holds Assistant Super Admin can set the count | Robert is a name in the note, not a role |
| Each coffee sale deducts one cup and 20 grams of beans | A drink does not deduct coffee stock | A later instruction: drinks are the menu, coffee stock is only a count |
| The register adds the free visit reward | The branch hands the gift. POS shows it. The sale total stays the money that was paid | A free line would change what counts as a sale |

## Not verified in a browser

Queue, POS voucher, cash-advance ask, payslip sign, bills edit, profit-and-loss click, restock approval, and the points shop were checked by unit tests and by the live database functions. Nobody clicked through them in the app after this work.

## Where to look

| Concern | Path |
|---|---|
| Checklist | `docs/plans/2026-10-25-new-changes-checklist.md` |
| Stock rules | `docs/inventory/STOCK-CATEGORIES.md` |
| Customer texts | `docs/notifications/CUSTOMER-TEMPLATE-REVIEW.md` |
| Daily Sheet math | `docs/daily-sheet/FORMULAS.md` and `src/lib/sheetFormulas.js` |
| Cash-advance balance | `src/lib/cashAdvanceBalance.js`, RPC `cash_advance_ledger` |
| Payslips | `src/lib/payslip.js`, `/operations/payslips` |
| Visit rewards | `src/lib/rewardsCatalog.js`, `server/lifecycleSms.mjs` |
| Restock approval | `supabase/migrations/20261026210000_inventory_categories.sql`, `/operations/approvals` |
