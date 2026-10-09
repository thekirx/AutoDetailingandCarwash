# CRM / SMS

**Route:** `/operations/crm`  
**Shell:** Floor (Marketing) / Command

## Purpose
Customers, insights, BusyBee SMS. Register / add-vehicle uses catalog brand/model and pricing sizes (Small–XL), not body-style labels.

## Components
FilterBar, DataTable, Tabs, charts in insights panel.

## Smart groups (`?tab=groups`)
Build a customer list for a campaign (`CrmSmartGroupsPanel`, logic in `src/lib/crmSmartGroups.js`).

- **Start from** a preset: visited in the last 7 / 30 / 90 days or 6 months, new customers (first visit in 30 days), lapsed 90+ days, never visited.
- **Who:** visited, first visit (new customers), last visit, signed up, or never visited.
- **When:** last N days / weeks / months, more than N ago, between two dates, a month range, or any time.
- **Refine:** min / max visits, min spend (pesos), branch (when you see more than one), only SMS-reachable.
- The sentence under the count says exactly what the group is. Sort, show more, export CSV, save the group by name (saved per user in this browser), delete a saved group.
- A visit is a **completed** booking (by completed date); bookings on the same visit group count once. Cancelled and no-show bookings are not visits. Spend is the completed booking price.

## Insights (`?tab=insights`)
Paid POS revenue for the chosen days, dates and branches (`CrmInsightsPanel`, logic in `src/lib/crmInsights.js`). Revenue only, no costs, so every CRM reader sees the same view.

- **Days:** Mon to Sun toggles plus Every day / Weekdays / Weekends. At least one day stays on.
- **Date:** Today, Yesterday, Last 7 days, This week, Last 30 days, This month (default), Last month, Last 3 months, This year, or a custom start and end.
- **Branches:** All branches or any mix of branch chips (only shown when you see more than one branch; branch-scoped roles pick within their own).
- The line under the filters reads back the choice; **Reset filters** returns to every day, this month, all branches. Every card and export below follows all three filters.
- **Best day** tile and the **Most profitable days** card: each weekday's revenue divided by how many of that weekday fall in the range (up to today), so a month with five Saturdays does not win on count alone. The card also lists the 5 best dates (with the branch that led each) and a **By branch** table of average revenue per weekday, shaded against each branch's own best day.
- All dates are Asia/Manila.

## Customer profile
**View** (Smart groups or Directory) opens a modal (`CustomerProfileDialog`): contact and reachability badges, membership, KPIs (visits, lifetime value, average per visit, days since last visit, visit cadence, loyalty points), usual branch and top services, then tabs for every visit (cancelled / no-show amounts struck through as not charged), POS purchases, vehicles, loyalty ledger and notes. Message, Edit profile and Add vehicle open from inside it.

The **Notes** tab has two lists. **Ticket notes** are the Notes field a Team Lead types on the New ticket form (`bookings.notes`, also typed on bookings), one per visit, with the Team Lead's name, date, branch, queue number and plate. **Guest notes** (`customer_notes`) are likes, dislikes and preferences. Every CRM reader sees both: Super Admin, ASA with the CRM grant, Marketing, Sales and Operations Lead. Only CRM editors (Super Admin, ASA, Marketing) get the Add note form; Sales and Operations Lead are view only.
