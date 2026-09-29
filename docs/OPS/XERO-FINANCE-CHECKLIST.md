# Xero-style Finance and Reporting: build checklist

Context and reference figures: [XERO-FINANCE-PURPOSE.md](XERO-FINANCE-PURPOSE.md).
Written 28 Sep 2026. Updated 29 Sep 2026: the Square sales pages (section 0) and part of section 6 are built; the Xero P&L items are not. Mark an item done only with a test or command that proves it.

## 0. Square sales summary and home (Reporting) - built 29 Sep 2026

- [x] Dashboard tab: Square Home tiles (Gross sales, Transactions, Labor % of net sales, Average sale, Discounts & comps, Net sales) with a change chip vs the prior period. N/A when the prior value is 0.
- [x] Dashboard tab: Locations table (net sales, transactions, labor %) per branch, sortable, with change chips.
- [x] Reports tab: Today / Week / Month / Quarter / Year tabs, Sales summary (gross, sales, average, net, returns & refunds, discounts & comps), Sales by payment type, Top items (count and gross).
- [x] "This quarter" period preset.
- Tips and fees are not shown: Hakum records neither. Returns & refunds stay at 0 until POS has a refund flow.
- Proof: `tests/salesSummary.test.js` (helpers in `src/lib/salesSummary.js`), `npm test`, `npm run build`, screenshots in `e2e-evidence/square-finance/`.

**Now** = next build pass (small, uses data Hakum already has). **Later** = needs an owner decision or a migration with more risk.

## 1. Chart of accounts (Finance)

- [ ] **Now** — Add a `code` column to `expense_categories` (text, unique when set). Seed the Xero names with codes 10–19 exactly as in the purpose doc. Add Shipping and/or Delivery Fees and Taxes and Accounting Fees without a code until the owner confirms theirs.
- [ ] **Now** — Map the old seed categories onto the Xero names: Chemicals → Chemical and Other Inventory (12), Equipment → Equipments and Tools (15), Marketing → Marketing Expenses (17), Utilities → Rent and Operating Utilities (19), Payroll → Employee Salary and Incentives (14). Rename in place so existing expenses keep their category. Never delete a category that has expenses.
- [ ] **Now** — Categories tab: show the code, sort by code, then by name. Code is optional on create.
- [ ] **Later** — Owner decides where General goes (Online Expenses and Others, or keep it).
- Test seam: a pure helper that orders categories by code and a migration test that the renames keep `expenses.category_id`.

## 2. Profit and Loss statement (Finance)

- [ ] **Now** — Income section: "Sales" = paid `total_minor + discount_minor`, "Discounts" = `-discount_minor`, "Total trading income" = paid `total_minor`. Confirm in the POS sale code that `total_minor` is after the discount before building this.
- [ ] **Now** — Show "Cost of sales" and "Gross profit" rows. Cost of sales is 0 (shown as a dash) until a category is flagged cost-of-sales.
- [ ] **Later** — `expense_categories.is_cost_of_sales` flag so a bill can move into Cost of Goods Sold.
- [ ] **Now** — Operating expenses: one line per category in code order, then Total operating expenses, then Net profit or Net loss (brackets or red for a loss, matching today's "Net loss" label).
- [ ] **Later** — Bill date: add `expenses.expense_date` (defaults to `created_at` date) and date the P&L by it, not by `created_at`. Owner confirms before the view changes.
- Test seam: extend `rollupPl` in `src/lib/financeData.js` (or add a sibling) with discount, gross profit, and a loss month using the August shape.

## 3. Compare periods (Reporting on the P&L)

- [ ] **Now** — When the range is exactly one calendar month, offer "Compare with" 1, 2, 3, 4 earlier months. Each adds one column, newest on the left, like Xero.
- [ ] **Now** — Keep today's None / Previous period / Previous year for any other range.
- [ ] **Now** — Disable a compare grain shorter than the range (for example, month compare when the range is a quarter) and say why under the control.
- [ ] **Later** — "Enter a different number" beyond 4, and quarter columns.
- Test seam: a pure function that returns the list of column ranges for (range, mode, count), plus the disabled reason.

## 4. Branch tracking (Finance)

- [ ] **Now** — "Compare branch" on the P&L: one column per branch (Bacoor, Batangas) plus Total, using the `branch` already on sales and expenses. Super Admin and ASA only; branch-assigned roles keep their one branch.
- Test seam: a helper that pivots `finance_daily_pl` rows by branch and matches the single-branch totals.

## 5. This month vs year to date (Finance)

- [ ] **Now** — Categories or Dashboard: a watchlist table with code, account, this month, and YTD (1 Jan to today, Asia/Manila), from the same `finance_daily_pl` rows.
- [ ] **Now** — Dashboard: year-to-date net profit, income, and expenses as one card.
- Test seam: YTD window helper (Manila time) and a rollup test.

## 6. Year-over-year sales chart (Reporting)

- [x] Reports tab (period Year): "Gross sales by month", this year vs last year to the same date, one pair of bars per month. Source is paid POS gross (`total_minor + discount_minor`), labeled **Gross sales**. Helper: `grossByMonth`.
- [ ] **Now** — Months after today showing last year only (the chart stops at the current month today, because the compare read is last year to date).
- [ ] **Now** — Show last year's to-date total next to this year's (today the Gross sales tile shows only the change %).
- Test seam: a helper that buckets paid sales by Manila month for two years.

## 7. Recent payments by branch (Finance)

- [ ] **Later** — Dashboard "Recent POS days" already covers the purpose. Only add a per-sale list if the owner asks for invoice-style rows.

## 8. Export and saved layouts

- [ ] **Now** — CSV export follows the new sections and compare columns (Section, Account code, Account, one column per period).
- [ ] **Later** — "Save as custom": saved filter sets per user. Filters already live in the URL, so a bookmark covers most of this today.

## Out of scope

- Xero OAuth, Square API, or any two-way sync.
- Double-entry journals, balance sheet, bank reconciliation, VAT or BIR returns.
- Changing payroll math. Salary reaches the P&L only when a payroll run posts it as an expense.
- Owner daily SMS. Finance accept stays on web push.

## Done means

- Unit tests for each helper above pass (`npm test`).
- `npx eslint .` and `npm run build` exit 0.
- Browser check of the P&L at 375 px and 1440 px with a loss month and a two-branch compare.
- `graphify update .` after code changes.
