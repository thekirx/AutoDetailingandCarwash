# Hakum Auto Care — domain glossary

Short vocabulary for audits and architecture reviews. Expand as seams deepen.

| Term | Meaning |
|------|---------|
| Floor | Live queue board + ticket lifecycle (waiting → … → payment). Queue = same-day services & packages only. Dashboard lanes split **Services & packages** vs **Detailing** |
| Bookings | Detailing multi-day pipeline (Assigned → intake → … → release). Ceramic / tint / PPF / paint maint only — not wash Queue. Cards: detailing type over `car - plate` |
| POS catalog | Sell tabs: **Services & packages** (same-day) · **Detailing** · Merch. Size pricing is on by default for new catalog SKUs (S/M/L/XL). Packages = mixed `included_service_ids` or custom price. Online `/book` is detailing-only; wash queue rejects detailing SKUs |
| Inventory | `/operations/inventory` mirrors POS: **Services & packages** · **Detailing** · Merch — separate create/list so bay and multi-day data stay distributed |
| Visit group | Multi-service tickets sharing one `queue_number` / `visit_group_id` |
| Queue allocator | `queue_number_counters` + `assign_daily_queue_number` (atomic per branch/day) |
| Handoff | Queue → POS payment transfer (`pos_handoffs` / sale) |
| ASA | `assistant_super_admin` with `permission_grants` toggles |
| Branch scope | `getBranchScopeList` / `user_has_branch_access` — null = all sites |
| Public queue | DEFINER views projecting only branch/queue_number/status |
| Cars catalog | Super Admin `/operations/cars` — `vehicle_catalog` make/model + `size_slug` (`small` \| `medium` \| `large` \| `extra_large`). Active rows feed the floor/book picker. Size auto-fills `bookings.vehicle_type` for service/package prices; TL/customer may override |
| Car size | Bay/pricing tier from body footprint. Small = sedans/hatchbacks · Medium = crossovers · Large = SUVs/pickups/larger MPVs · Extra Large = full-size vans/people movers. Same slugs as `service_size_prices`. Legacy `sedan`→small, `suv`/`pickup`→large, `van`→extra_large, `motorcycle`→small |
| Data Center | Super Admin only. Catalog/CRM importable; floor/finance export-only (PITR). Standard purge: archived tickets/vehicles/customers (FK-safe) + 90d logs / 365d audit |
| Loyalty program | Singleton `loyalty_program_settings` — SA kill-switches for stamps / points / memberships |
| Stamp earn mode | `all_weighted` or `pay_categories` (e.g. wash-only carwash stamps) |
| Service loyalty weight | `services.loyalty_weight` × qty → stamp delta (0 = never earns) |
| Membership multiplier | Tier `loyalty_multiplier` on spend points; optional on stamps too |
| Membership POS pricing | Tier `discount_percent` + `included_services` applied on catalog POS lines (queue handoffs keep floor price) |
| First-account wizard | Customer onboarding steps: phone → name/plate → birthday perk → password. Interface: `src/lib/customerOnboarding.js` |
| Team Lead prefill | Queue-provisioned Auth with `must_set_password` autofills name/plate/phone on the wizard; claim path sets the password |
| Unactivated account | Team Lead queue provision: CRM row (+ optional Auth) with no customer-chosen password. Status `needs_password` or `needs_invite` |
| Account activate | Customer finishes the wizard on that same `customers.id` so visit history stays linked |
| Customer account lifecycle | Intent router for sign-in / signup / claim. Interface: `src/lib/customerAccountLifecycle.js` |
| Planner task | `plan_cards` + optional `category_id` / `due_at`. Editors create and assign; staff see assigned rows only |
| Planner category | First-class `plan_categories` (name, color). Boards stay a workspace filter (Planner / Equipment / Cash Advance) |
| Planner proof | Optional unless `plan_cards.proof_required`. Photo lives in private `plan-proofs` (`{uid}/{cardId}/file`). Assign notifies inbox + web push |
| Review inbox | Planner Review tab: assignees in `for_review`. Accept → `done`, send back → `in_progress` |
| Planner configure | Editors only. CRUD lists on the current board, shop-wide categories/templates, and boards. Assignee progress statuses stay fixed |
| Shop-day settlement | Wash pool (`washPoolAmountMinor`) + ceramic job drafts (`buildCeramicCompensationExpenses`) + daily close buckets. Branch scope is `getBranchScopeList`. Close skips ceramic/payroll drafts until paid. **Docs:** `docs/POS/` |
| POS counter | `/operations/pos` — BA tabs **Sell / Daily sheet / Today**; SA/ASA: bay + detailing + merch walk-in. Sale write = `complete_pos_sale`. Settings thin: `ops_pos_settings` |
| Daily Sheet | One per branch per Manila day (`daily_sheets` + `daily_sheet_lines`: expense, salary, ca_release, ca_repay). BA fills at POS, SA or ASA (finance_view) **Approve / Return** in Finance → Daily sheets. Formulas only in `src/lib/dailySheet.js`. Approve posts paid `expenses` once per line (salaries → account 14). SA can reopen (voids posted rows → Returned). **Docs:** `docs/daily-sheet/` |
| Accounts | Chart of accounts = `expense_categories` with Xero `code` 10–21. Salaries 14; monthly salaries are Bills under 14 |
| Suggested salary | Prefill on the sheet from `compensation.js` (wash pool by attendance weight, ceramic/detailer splits) + TL `staff_profiles.daily_rate_minor`. Editable; a change needs a reason. Rules in Settings → Daily sheet rules |
| Payroll (retired) | Payroll, My pay, Payroll settings and End of shift wizard removed. `payroll_runs`, `run_payroll` and `shift_close_reports` stay as locked legacy history. Old routes redirect (`/operations/payroll` → Finance Daily sheets, `/operations/my-pay` → `/operations`, `settings/payroll` → `settings/daily-sheet`); old closes are read-only in Finance → Old shift closes |
| Operations Lead | Network-wide role (`operations_lead`): planner + POS + queue (TL∪BA), all branches, **no attendance clock**. **Ops Lab** (`/operations/roadmap`) — customizable types/statuses, status notify to all Ops Lab peers, audited actions for SA. Multi-branch forms/EoS; detailing compensation is service-agnostic (not ceramic-only). |
| Cash advance | Staff request via ops form `cash_advance`. BA releases or records repayment as Daily Sheet lines; approved with the sheet. Moves drawer cash, never profit |
| Expense report | ASA draft/submit → expenses `pending_approval`. SA approve → `pending_payment` (not P&L yet). `approve_paid` or later `mark_paid` → `paid` → P&L. Interface: `review_expense_report` |

## Intentional denorm

Booking rows snapshot customer/vehicle fields at ticket time so floor history does not drift when CRM updates later.
