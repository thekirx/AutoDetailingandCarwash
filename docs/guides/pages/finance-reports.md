# Finance and Reports

> **Partly retired 2026-10-01.** End of Shift and the Payroll register were replaced by the **Daily Sheet**. There is no shift-close review queue to accept, reject or lock — a sheet is submitted by the branch and approved here, or returned with a note.

**Route:** `/operations/finance` (+ reports tab)  
**Shell:** Command

## Purpose
Cash flow, sales, P&L, purchases, Daily Sheets, quotes, vendors, categories. Income is **paid POS** only — never close overrides.

Two jobs, modeled on the owner's Xero and Square:

- **Finance** (Xero books): did the shop make money? P&L, chart of accounts, this month vs YTD, branch split.
- **Reporting** (Square sales): how much did the tills sell versus last year? Gross sales only, never labeled profit.

Reference figures and gaps: [Xero finance purpose](../../OPS/XERO-FINANCE-PURPOSE.md). Build list: [Xero finance checklist](../../OPS/XERO-FINANCE-CHECKLIST.md).

## Layout
Tabs → metric strip → charts / tables. URL filters: `tab`, `period`, `from`, `to`, `branch`, `compare`.

## Filters (owner customizability)

| Control | Values |
|---------|--------|
| Period | Today, Yesterday, This week, Last 7/30 days, This/Last month, This quarter, Last 3/6 months, This year, Custom |
| Branch | All (Super Admin) or one branch |
| Compare | None, Previous period, Previous year (drives the P&L numbers only) |

## Square sales (Dashboard and Reports)

The Dashboard tab opens like Square Home and the Reports tab like Square Sales summary. Both have Today / Week / Month / Quarter / Year buttons, which set the same `period` URL filter.

- **Dashboard:** Gross sales, Transactions, Labor % of net sales, Average sale, Discounts & comps, Net sales, then a **Locations** table (net sales, transactions, labor % per branch). The P&L strip and charts follow below.
- **Reports:** Sales summary, Gross sales by month (Year only), Top items (count and gross), Sales by payment type, then the existing shift close, sales, operations, and retention reports.

Metrics come from `sales` rows with status paid or refunded (helpers in `src/lib/salesSummary.js`):

| Metric | Rule |
|--------|------|
| Gross sales | `total_minor + discount_minor` |
| Discounts & comps | `discount_minor` |
| Returns & refunds | `total_minor` of refunded sales (0 until POS has a refund flow) |
| Net sales | gross minus refunds minus discounts (equals paid `total_minor`) |
| Sales / Transactions | number of tickets |
| Average sale | gross ÷ tickets |
| Payment types | paid tickets by Cash, GCash, Card (online counts as card) |
| Labor % of net sales | paid/posted `salary_*` or payroll-category expenses ÷ net sales; N/A when net is 0 |

Change chips compare with Square's "vs" window: Today vs the same weekday last week up to the same time; Week, Month, Quarter, Year vs the previous period up to the same day and time; any other range vs the equal-length previous window. A chip reads N/A when the prior value is 0. Tips and fees are not shown because Hakum records neither.

## Paid by kind

Overview shows package / service / detailing / PPF / merch buckets from `finance_daily_line_kind` (paid lines only). Zero buckets hide.

## Shift reviews

Accept / reject / lock. Super Admin may **Reopen for a new count** on an **accepted** close (note ≥ 3 chars) so Branch Admin can resubmit the drawer. Locked days stay locked. Reopen does not void payroll.

## Components
chart.jsx (recharts), FinanceChrome metrics, FilterBar, DataTable.

## Related
[Money contract](../OPS/MONEY-CONTRACT.md) · [Shop-day runbook](../qa/SHOP-DAY-RUNBOOK.md)
