# Daily sheet formulas

Source: `FOrmulas.md` (Sir). Code: `src/lib/sheetFormulas.js` and `computeSheetTotals` in `src/lib/dailySheet.js`. Server: `daily_sheet_server_totals` in migration `20261019230000_sheet_money_left_channels.sql`.

Amounts are minor units (centavos) in code. The sheet shows pesos.

## Sales

| Name | Rule |
|---|---|
| Total sales | Every **paid POS** ticket that Manila day (cash, GCash, credit card, debit card, bank transfer). |
| Car wash sales | Car-wash **service lines** only. Coffee, merch, and accessories on the same ticket are not car wash. |
| Ceramic coating sales | Ceramic coating service lines only. |
| Ceramic tint sales | Tint service lines only. |
| Paint protection film sales | PPF service lines only. |

The sheet lists those under **By service**. Coffee and merch stay on their own rows so they are not mixed into the service totals.

Payment rows: Cash, GCash, Credit card, Debit card, Bank transfer, Other. A blank method still counts as cash (POS default). An unknown method counts as Other and does **not** inflate the drawer.

## Expenses

Manual expense lines need a category, an amount, and **Paid from** Cash or GCash.

Crew pay (car wash, tinter, detailer) is a salary line. It is part of **total expenses** and of profit. On approve, expense and salary lines post to Finance as paid expenses for that branch. Salary lines also pick Cash or GCash (default Cash).

```
total expenses = manual expenses + salaries
net profit     = total sales (net) − total expenses
```

Cash advances are **not** expenses and do not change profit.

## Money left

```
Cash left  = POS cash
           + cash-advance paid back (cash)
           − expenses paid cash
           − salaries paid cash
           − cash advances given out (cash)

GCash left = POS GCash
           + cash-advance paid back (GCash)
           − expenses paid GCash
           − salaries paid GCash
           − cash advances given out (GCash)
```

Given out lowers money left. Paid back raises it. Neither is an expense.

Opening float is the till at the start of the day. It is not inside “cash left”. The drawer count uses:

```
expected cash = opening float + cash left
over / short  = cash counted − expected cash
```

## Apply on the database

Applied on project `lybxhpzzqqyqswvuwpxv` on 20 Oct 2026: `save_daily_sheet` keeps `paid_from` for salary and cash-advance lines, and `daily_sheet_server_totals` returns `cashLeftMinor` and `gcashLeftMinor`.

Checked on draft sheet `a87dbc89-8682-4930-a9d4-75422be98723` (Bacoor, 9 Oct 2026): one cash expense of 1000000 centavos, no paid POS. Server totals returned cash left −1000000, GCash left 0, expected cash −1000000.

## Checklist

Live project: `https://lybxhpzzqqyqswvuwpxv.supabase.co`. Checked 20 Oct 2026.

| Formula | Status | Evidence |
|---|---|---|
| Reports separate cash, GCash, credit card, debit card, and bank transfer | Fixed in code and in live POS settings | Daily sheet `METHOD_LABELS` and finance `paymentTypes` keep five buckets. `ops_pos_settings` id 1 now lists Cash, GCash, Credit Cards, Debit card, Bank transfer. Past paid sales are only cash (696), GCash (445), and card (154). Debit and bank rows stay zero until a sale is taken that way. |
| Total sales = all paid POS | Correct | `netMinor` is paid tickets for that branch and Manila day. Refunds are separate. |
| Car wash / ceramic coating / ceramic tint / PPF exclude refreshments and accessories | Correct on the sheet | Line items are classified in `paidSalesToBacoorRows`. Coffee and merch stay on their own rows. The database totals function does not recompute these four; the sheet does when it loads the day's sales. |
| Expenses need a category and cash or GCash | Correct before submit | The sheet will not submit an expense without a description, account, amount, and cash or GCash. The database allows a draft line with a blank category. |
| Salaries for car wash, tinter, and detailer are expenses | Correct | Salary lines are inside total expenses and profit. `review_daily_sheet` posts `expense` and `salary` only. |
| On approve, those expenses go to Finance for the branch | Correct | Same review function. Cash advances are not in that post (`ca_release` does not appear in the function). |
| Cash advance given out lowers money left and is not an expense | Correct | Subtracted in cash left / GCash left. Omitted from `totalExpensesMinor` and from profit. |
| Cash advance payment raises money left and is not an expense | Correct | Added by channel. Omitted from expenses. |
| Total GCash left = POS GCash + GCash cash-advance payments − GCash expenses | Correct, with salaries and GCash cash advances given out included | Prose in `FOrmulas.md` says salaries are expenses and cash advances given out are deducted. Both are in the live function. |
| Total cash left = POS cash + cash cash-advance payments − cash expenses | Correct, same inclusion | Opening float is not inside cash left. Expected drawer cash = opening float + cash left, so the count can be checked against the till. |
| One payment method per ticket | Still true | A ticket paid partly cash and partly GCash is not split. |

## Honest limits

- The old Bacoor text close is read-only history. It still folds an approved cash advance into its own expense total. New days use the daily sheet, not that text.
- The Super Admin floor tile still groups debit and bank transfer with credit card. The daily sheet and the finance sales summary do not.
- This pass did not click a new debit or bank-transfer sale on the live site.

## How jobs are grouped

Settled from the live catalog. Not a question for Sir.

| Job | Where it lives | Daily sheet line |
|---|---|---|
| Carwash, Express Wash, Full Care, Hakum Custom | Same-day queue. These are services and wash packages. | Car wash sales |
| Interior, full exterior, mobile, glass detailing | Same-day. The word detailing in the name does not move them. | Car wash sales |
| Ceramic coating, Premium, Platinum | Detailing booking list. Premium and Platinum are levels of ceramic, not wash packages. | Ceramic coating sales |
| Nano ceramic tint | Detailing booking list | Ceramic tint sales |
| PPF and its levels (Basic, High Impact, Platinum, Ultimate) | Detailing booking list. Crew pay is not the ceramic split. | Paint protection film sales |
| Paint maintenance | Detailing booking list. Return visit after ceramic or PPF. | Paint maintenance sales |
| Coffee, drinks, accessories | Counter add-ons | Their own rows |

## Ask Sir Michi

Plain-language copy: `docs/plans/2026-10-20-sir-michi-questions.pdf`.

1. Credit card, debit card, and bank transfer count in total sales and stay out of Cash left and GCash left.
2. Cash left does not include the opening float. Expected cash is opening float plus cash left.
3. Cash advances given out are deducted from money left and are not expenses.
4. A salary paid from GCash reduces GCash left, not the cash drawer.
5. One ticket has one payment method.
