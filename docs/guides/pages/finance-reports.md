# Finance and Reports

**Route:** `/operations/finance` (+ reports tab)  
**Shell:** Command

## Purpose
Cash flow, sales, P&L, purchases, shift closes, quotes, vendors, categories. Income is **paid POS** only — never close overrides.

## Layout
Tabs → metric strip → charts / tables. URL filters: `tab`, `period`, `from`, `to`, `branch`, `compare`.

## Filters (owner customizability)

| Control | Values |
|---------|--------|
| Period | Today, Yesterday, This week, Last 7/30 days, This/Last month, Last 3/6 months, This year, Custom |
| Branch | All (Super Admin) or one branch |
| Compare | None, Previous period, Previous year |

## Paid by kind

Overview shows package / service / detailing / PPF / merch buckets from `finance_daily_line_kind` (paid lines only). Zero buckets hide.

## Shift reviews

Accept / reject / lock. Super Admin may **Reopen for a new count** on an **accepted** close (note ≥ 3 chars) so Branch Admin can resubmit the drawer. Locked days stay locked. Reopen does not void payroll.

## Components
chart.jsx (recharts), FinanceChrome metrics, FilterBar, DataTable.

## Related
[Money contract](../OPS/MONEY-CONTRACT.md) · [Shop-day runbook](../qa/SHOP-DAY-RUNBOOK.md)
