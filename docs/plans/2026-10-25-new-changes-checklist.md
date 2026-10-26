# NewChanges checklist

Source: `NewChanges.md` (Hakum notes, 25 Oct 2026). Later instructions override two lines: coffee drinks do not deduct cups or grams, and Robert is not an account.

Status key: **Done** means the screen and the database agree. **Kept** means the note and a later rule disagree, and the later rule is what the app does.

## Shop day

| Note | Status | What happens |
|---|---|---|
| Queue number on every wash, package, and detailing ticket | **Done** | `bookings.queue_number` |
| New ticket at the bottom. Oldest waiting car is next | **Done** | FIFO in `fifoNextTicketId`. “Newest on top” would hide the next car |
| Existing customer name on the ticket | **Done** | Queue selects include `customer_name` |
| Notes for Team Lead and crew | **Done** | The ticket always shows notes, or “No notes” |
| Branch Admin sells merch and coffee drinks only, on a ticket the Team Lead already sent to payment | **Done** | `assertBranchAdminCart`. They cannot rewrite the Team Lead ticket |
| Optional voucher on the ticket and at checkout | **Done** | Team Lead, Branch Admin, and office. A walk-in with no ticket cannot use a code |
| Say cash, not drawer | **Done** | Daily Sheet labels and the close hint |
| Floor board renamed Floor Insight | **Done** | Route stays `/operations/dashboard` |
| Administrative crew removed from the floor page | **Done** | The tile row is gone |
| Attendance line | **Done** | `Crew 8 of 10 · Team Lead 2 of 2 · Admin 1 of 2`. The register can be filtered by role |
| POS shows the customer’s points | **Done** | Linked customer shows points, the visit reward already reached, and the next one |

## Money

| Note | Status | What happens |
|---|---|---|
| Cash advance ask, history, partial pay, paid up | **Done** | My advances: amount and what it is for. Not the planner form. Approval still writes the code. The Daily Sheet records the cash. Remaining is on My advances, the POS Cash advances tab, and the sheet when the name is chosen |
| Who sees unpaid advances | **Kept** | Owner sees them on Floor Insight. Branch Admin and ASA use POS or the Daily Sheet. The 19 Oct sheet does not give them Floor Insight |
| Bills edit, for-approval count, awaiting-payment amount | **Done** | Edit opens the bill form. The strip splits “For approval” and “Awaiting payment” |
| Profit and loss lines | **Done** | An expense account opens the paid bills that make it up |
| Crew are not monthly. Office pay is bi-monthly, no tax, incentive, payslip, received, e-sign | **Done** | Crew, team leads, and detailers stay on the Daily Sheet. Monthly salaries sends a half-month slip. Salary plus incentive. The person marks it received and signs. Super Admin and ASA with finance write can add the incentive |

## Customers

| Note | Status | What happens |
|---|---|---|
| Visit rewards at 6, 12, 18, 24, 30, any car | **Done** | Rewards page and POS show the reward reached and the next one. The branch hands the gift. The register does not add a free line |
| Points table and merch point prices | **Done** | Matching service rows use the note. Premium ceramic is 20, Platinum ceramic is 25, High Impact Partial is 30. The ten merch items are in the catalog at those point prices. A claim deducts that branch’s stock and stays disabled until the branch has some. They stay off the register until a peso price is set |
| Member tier by total visits | **Done** | 1–29 Basic, 30–69 Deluxe, 70–99 Premium, 100+ Platinum, from completed visits |
| Customer app and SMS copy | **Done** | Outbound customer status and reminders only. No owner daily SMS. A text goes out at visits 6, 12, 18, 24, and 30 with that reward. The old 4th-visit and 10th-visit stamp texts are no longer sent. Copy is in `docs/notifications/CUSTOMER-TEMPLATE-REVIEW.md` |

## Stock

| Note | Status | What happens |
|---|---|---|
| Merchandise and coffee drinks on POS. Coffee stock and chemicals off POS | **Done** | Coffee drinks are their own items. Coffee stock is a count. A drink sale does not deduct cups or grams |
| Show in POS toggle | **Done** | Coffee stock and chemicals stay hidden. Point-only merch stays hidden until it has a peso price |
| Branch Admin restocks. Super Admin approves. No cost | **Done** | The count moves on approval. The approval does not create a bill |
| Owner and Lucy can correct a count | **Done** | Owner is BossMich. Lucy is whoever holds Assistant Super Admin. They can set the count |
| Robert can correct a count | **Kept** | Robert is a name in the note, not a role. No account was created |
| Approvals page and a waiting count on Floor Insight | **Done** | `/operations/approvals`. Floor Insight shows the waiting count for the owner. Assistant Super Admin can open the page and cannot approve a restock |

## Database

Live on `lybxhpzzqqyqswvuwpxv` (26 Oct 2026): `cash_advance_ledger`, `payslips`, points updates, voucher apply for Branch Admin and office, `restock_requests`, and the drop of the coffee cup-and-grams deduction. `20261026230000` adds the ten point-shop merch items when the name is not already in the catalog. `20261026240000` sets Premium ceramic to 20, Platinum ceramic to 25, and High Impact Partial to 30.

Screens in this list were not clicked in a browser this pass.
