# Daily sheet formulas

Source: Sir’s answers on 21 Oct 2026. They replace the morning-float reading of `FOrmulas.md`. Code: `src/lib/sheetFormulas.js` and `computeSheetTotals` in `src/lib/dailySheet.js`. Server: `daily_sheet_server_totals` in migration `20261021120000_sheet_collection_no_float.sql`.

Amounts are minor units (centavos) in code. The sheet shows pesos.

## Sales

| Name | Rule |
|---|---|
| POS sales | Every **paid POS** ticket that Manila day. |
| Total sales | POS sales − cash advances given out (cash and GCash). |
| Total credit/debit transaction | Credit card + debit card + bank transfer. In total sales. Not in cash left or GCash left. |
| Car wash / ceramic coating / ceramic tint / PPF | Those service lines only. Coffee, merch, and accessories stay on their own rows. A split tender does not change which service was sold. |

Payment rows: Cash, GCash, Credit card, Debit card, Bank transfer, Other. A blank method still counts as cash. An unknown method counts as Other and does not inflate the drawer.

One ticket may be paid partly cash and partly GCash. The ticket counts once in total sales. The cash portion joins cash. The GCash portion joins GCash. Card, debit, and bank transfer stay one method for the whole ticket.

## Expenses and profit

Manual expenses need a category, an amount, and **Paid from** Cash or GCash.

```
total expenses = manual expenses + salaries
total sales    = POS sales − cash advances given out
net profit     = total sales − total expenses
```

A cash advance is not an expense and is not posted to Finance. It lowers the sales figure, so profit is lower by that amount without calling it an expense. Salary is an expense, so it lowers profit once.

## What is left to collect

Salary is taken out of the channel it was paid from. It is not taken out a second time from what is left.

```
total cash transaction  = POS cash − salaries paid cash
total GCash transaction = POS GCash − salaries paid GCash

cash left  = total cash transaction
           + cash-advance paid back (cash)
           − expenses paid cash
           − cash advances given out (cash)

GCash left = total GCash transaction
           + cash-advance paid back (GCash)
           − expenses paid GCash
           − cash advances given out (GCash)
```

There is no morning float. All cash is collected as it is. Cash left is the collection. Over / short = cash counted − cash left.

## Checklist — frontend and backend

Live project: `https://lybxhpzzqqyqswvuwpxv.supabase.co`. Applied 21 Oct 2026. `submit_daily_sheet` no longer asks for a morning float. `complete_pos_sale_impl` stores a cash + GCash split. `daily_sheet_server_totals` subtracts salary once inside the channel transaction. Execute on that function stays with `postgres` and `service_role` only.

| Sir’s answer | Sheet (frontend) | Totals (JavaScript) | Database |
|---|---|---|---|
| Credit, debit, and bank stay in sales and out of both drawers. The report has Total credit/debit transaction. | Payment rows plus that total on the sheet and the close slip | `creditDebitMinor` = card + debit + bank | `daily_sheet_server_totals` returns `creditDebitMinor`. Those methods are not added to cash or GCash. |
| No morning float. The day’s cash is collected as it is. | No opening-float field. Count is compared with cash left. | `expectedCashMinor` = cash left. Submit does not ask for a float. | `submit_daily_sheet` no longer requires a float. Expected cash is cash left. |
| Cash advance leaves the drawer, comes off total sales, and is not an expense. | Total sales shows POS minus advances. Expenses do not include them. | `totalSalesMinor` = net POS − advances given. `totalExpensesMinor` = expenses + salaries. Profit uses total sales. | Same expression: `v_net - v_rel - v_exp - v_sal`. Approve still posts only expense and salary. |
| GCash salary comes out of the GCash transaction. Cash salary comes out of the cash transaction. Left is what remains to collect. | Total cash transaction and Total GCash transaction sit above cash left and GCash left. | `moneyLeft` subtracts salary once, inside the transaction, then builds left from that. | `v_cash_txn := v_cash - v_sal_cash`, then left does not subtract salary again. |
| A ticket can be split between cash and GCash. | POS tender has Cash + GCash. The two amounts must add up to the ticket. GCash reference still required. | `saleTenderPortions` puts each portion in its channel. The sale still counts once. Sheet, Today, finance, floor, and the audit load those rows with `saleMoneySelect`, which always includes both portions. | `sales.cash_minor` and `sales.gcash_minor`. `complete_pos_sale_impl` rejects a split that does not add up. `daily_sales_summary` adds those portions into cash and GCash. |

## Honest limits

- Sheets saved before this change keep their old stored totals until they are saved again. An audit does not call that drift. The new arithmetic is what the screen and `daily_sheet_server_totals` compute now.
- The old Bacoor text close is read-only history. It still folds an approved cash advance into its own expense total. New days use the daily sheet.
- A draft expense can still be saved without a category. Submit blocks it.
- Sized products whose on-hand count is still on the blank size key need that count set per size before POS will deduct it.
- This pass did not click a live split sale or a live debit/bank sale on the register.

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
