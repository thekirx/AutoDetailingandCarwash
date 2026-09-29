# Xero and Square: what Hakum Finance and Reporting are for

Source: owner screenshots of Hakum Auto Care's Xero (org `Y-7wX`) and Square Reports, taken **28 Sep 2026**.
The figures below are **reference snapshots from those tools**, not Hakum ledger truth. Hakum income stays **paid POS only** (see [Money contract](MONEY-CONTRACT.md)).

Build checklist: [XERO-FINANCE-CHECKLIST.md](XERO-FINANCE-CHECKLIST.md).

## Two jobs, two screens

| | Finance (Xero books) | Reporting (Square sales) |
|---|---|---|
| Question | Did the company make money, and where did the money go? | How much did the tills sell, versus last year? |
| Main view | Profit and Loss for a date range | Yearly gross sales, one bar per month |
| Money | Trading income minus operating expenses = net profit or loss | Gross sales only (no expenses) |
| Hakum home | `/operations/finance` → P&L, Dashboard, Bills, Categories | `/operations/finance?tab=reports` (today: shop operations, not this chart) |

Do not merge the two into one number. Square **₱7,034,390** (gross sales, 1 Jan – 28 Sep 2026) and Xero **13,693,055** (income on the Xero home widget, 1 Jan – 28 Sep 2026) are different measures from different tools. Neither is Hakum's paid-POS income.

## Finance: the Xero Profit and Loss

URL pattern `reporting.xero.com/!Y-7wX/v1/Run/1016`. Title "Profit and Loss · Hakum Auto Care · For the month ended 30 September 2026".

### Statement shape

1. **Trading Income**: Square Sales, then Square Discounts as a negative line, then Total Trading Income.
2. **Cost of Sales**: Cost of Goods Sold. Used once this year (January, 1,100). Shown as a dash in other months.
3. **Gross Profit** = trading income minus cost of sales. Equals trading income in every month except January.
4. **Operating Expenses**: one line per account (list below), then Total Operating Expenses.
5. **Net Profit**. A loss shows in brackets (August).

### September 2026 (single month)

| Line | Amount |
|---|---|
| Square Sales | 1,380,850.00 |
| Square Discounts | (2,810.00) |
| **Total Trading Income / Gross Profit** | **1,378,040.00** |
| Chemical and Other Inventory | 212,217.00 |
| Coffee and Other Supplies | 3,000.00 |
| Employee Salary and Incentives | 486,761.07 |
| Equipments and Tools | 6,150.00 |
| Labor and Repair Maintenance | 3,550.00 |
| Marketing Expenses | 29,300.00 |
| Meals and Entertainment | 6,034.00 |
| Online Expenses and Others | 5,244.00 |
| Rent and Operating Utilities | 361,596.95 |
| Shipping and/or Delivery Fees | 3,032.00 |
| Taxes and Accounting Fees | 41,918.69 |
| **Total Operating Expenses** | **1,158,803.71** |
| **Net Profit** | **219,236.29** |

### January to September 2026 (compare columns)

| Month | Trading income | Operating expenses | Net profit |
|---|---|---|---|
| Sep | 1,378,040.00 | 1,158,803.71 | 219,236.29 |
| Aug | 1,485,080.00 | 1,741,445.12 | (256,365.12) |
| Jul | 1,774,050.02 | 1,317,002.85 | 457,047.17 |
| Jun | 1,570,105.00 | 1,378,996.42 | 191,108.58 |
| May | 1,927,840.00 | 1,603,662.15 | 324,177.85 |
| Apr | 1,405,820.00 | 1,295,660.15 | 110,159.85 |
| Mar | 1,513,210.00 | 1,133,654.45 | 379,555.55 |
| Feb | 1,295,910.00 | 1,061,376.46 | 234,533.54 |
| Jan | 1,343,000.00 | 1,142,586.35 | 199,313.65 (after COGS 1,100) |

What the owner reads from this: salary and rent are the two biggest costs every month. Chemicals swing (Aug 442k, May 456k). One bad month (August) can wipe out a good one, so the statement must show a loss plainly.

### Compare controls

- **Compare with**: None, 1, 2, 3, 4 months, or "Enter a different number". Each adds one earlier column.
- **Previous**: Month, Quarter, Year, or Custom date range.
- When the selected range is longer than the compare grain, Xero disables those options ("Options are disabled because the report date range is longer").
- **Compare tracking categories**: split one statement by a tracking category. Hakum's equivalent is branch.
- Other actions: Filter, More, Update, Save as custom, Export, Compact view, View profitability graphs.
- Saved layouts on the left: Budget Variance, Current and previous 3 months, Current financial year by month, Month to date comparison, Year to date comparison, Compare Branch.

### Chart of accounts (home watchlist)

Stable codes, with this month and year-to-date side by side.

| Code | Account | This month | YTD |
|---|---|---|---|
| 10 | Meals and Entertainment | 6,034.00 | 63,439.00 |
| 11 | Apparel Inventory | 0.00 | 97,660.00 |
| 12 | Chemical and Other Inventory | 212,217.00 | 2,340,215.72 |
| 13 | Coffee and Other Supplies | 3,000.00 | 138,846.60 |
| 14 | Employee Salary and Incentives | 486,761.07 | 5,179,740.52 |
| 15 | Equipments and Tools | 6,150.00 | 117,347.98 |
| 16 | Labor and Repair Maintenance | 3,550.00 | 252,817.43 |
| 17 | Marketing Expenses | 29,300.00 | 561,184.00 |
| 18 | Online Expenses and Others | 5,244.00 | 87,818.00 |
| 19 | Rent and Operating Utilities | 361,596.95 | 2,648,971.92 |

Not on the watchlist but on the P&L: Shipping and/or Delivery Fees, Taxes and Accounting Fees, Square Sales, Square Discounts, Cost of Goods Sold. Their codes were not visible in the screenshots, so none are listed here.

### Home widgets

- **Net profit or loss, year to date**: 1,858,767.36 (1 Jan – 28 Sep 2026). Income 13,693,055. Expenses 11,834,288. "No data from Jan 1 – Sep 28, 2025" (the books start in 2026).
- **Recent invoice payments**: one invoice per branch per day, e.g. INV-0560 "Hakum Auto Care - Bacoor" 27 Sep (34,210 and 11,350), INV-0561 "Hakum Auto Care - Batangas City" 27 Sep (21,510 and 1,350). Branch is the invoice contact.

## Reporting: Square yearly gross sales

- Tabs: Today, Week, Month, Quarter, Year. "All Devices".
- **Year view**: This year ₱7,034,390.00 vs previous year ₱6,286,050.00 (1 Jan – 28 Sep).
- One pair of bars per month (this year blue, last year gray). Months after today show last year only.
- This is **gross sales from the tills**. No expenses, no net profit.

## How this maps to Hakum today

| Xero / Square | Hakum today | Gap |
|---|---|---|
| Square Sales | `finance_daily_pl` income line "POS sales" = sum of paid `sales.total_minor` ([view](../../supabase/migrations/20260811130000_finance_pl_views.sql)) | One income line only |
| Square Discounts | `sales.discount_minor` is stored ([POS integrity](../../supabase/migrations/20260914120000_pos_sale_integrity.sql)) but not shown on the P&L | No discount line |
| Cost of Sales / Gross Profit | Not modeled | No section |
| Operating expense accounts 10–19 | `expense_categories` (seeded General, Utilities, Payroll, Chemicals, Equipment, Marketing) + `kind` | Names and codes differ; no code column |
| Expense date | `finance_daily_pl` dates an expense by `expenses.created_at` | Xero dates by the bill date |
| Net profit or loss | `rollupPl` in [financeData.js](../../src/lib/financeData.js); P&L tab shows "Net loss" when negative | OK |
| Compare 1–4 months as columns | `COMPARE_PRESETS`: None, Previous period, Previous year (one extra column) | No multi-month grid |
| Compare branch | Branch filter (one branch or all) | No side-by-side branch columns |
| This month vs YTD per account | Not shown | Missing |
| Recent invoice payments by branch | Dashboard "Recent POS days" | Similar purpose; per day, not per invoice |
| Export / Save as custom | CSV export on P&L; filters kept in URL | No saved layouts |
| Square yearly gross vs last year | Reports tab shows bookings, retention, shift closes, best sellers | No year-over-year sales chart |

## Rules that do not change

- Hakum income = **paid POS**. Shift-close overrides never rewrite sales.
- Expenses hit the statement only when **paid** or **posted**.
- Salary appears on the P&L only after a payroll run posts it as an expense. Pay math stays on Payroll.
- No Xero or Square API sync in this scope. Xero stays the accountant's book of record until the owner says otherwise.
- Finance accept notifies Super Admin / ASA by **web push**. No owner daily SMS.
