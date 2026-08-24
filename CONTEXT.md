# Hakum Auto Care — domain glossary

Short vocabulary for audits and architecture reviews. Expand as seams deepen.

| Term | Meaning |
|------|---------|
| Floor | Live queue board + ticket lifecycle (waiting → … → payment). Queue = same-day services & packages only |
| Bookings | Detailing multi-day pipeline (Assigned → intake → … → release). Ceramic / tint / PPF / paint maint only — not wash Queue. Cards: detailing type over `car - plate` |
| POS catalog | Sell tabs: **Services & packages** (same-day) · **Detailing** · Merch. No global size filter — size pricing is optional per catalog item (multi-select). Packages = mixed `included_service_ids` or custom price |
| Inventory | `/operations/inventory` mirrors POS: **Services & packages** · **Detailing** · Merch — separate create/list so bay and multi-day data stay distributed |
| Visit group | Multi-service tickets sharing one `queue_number` / `visit_group_id` |
| Queue allocator | `queue_number_counters` + `assign_daily_queue_number` (atomic per branch/day) |
| Handoff | Queue → POS payment transfer (`pos_handoffs` / sale) |
| ASA | `assistant_super_admin` with `permission_grants` toggles |
| Branch scope | `getBranchScopeList` / `user_has_branch_access` — null = all sites |
| Public queue | DEFINER views projecting only branch/queue_number/status |
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
| POS counter | `/operations/pos` — BA: merch + Pay queue + expenses + End of shift; SA/ASA: bay + detailing + merch walk-in. Sale write = `complete_pos_sale`. Settings thin: `ops_pos_settings` + `shift_close_field_config`. End of shift attests paid-sales baseline; does **not** pay payroll |
| Payroll run | Dual track: **Floor** (bay + POS) vs **Fixed** (company-wide, no bay). Fixed wizard: Period → Employees → Commissions → full Review. Packages may omit branch (books under `hq`). Dashboard **Pending floor pay** stacks accepted end-of-shift days with no covering floor run; when `pending_floor_optional` is false, floor confirm is **hard-blocked** until closes are accepted. CA deduct is **manual in wizard only** (approve binds `staff_id`). Day report uses `shopDaySettlement` (paid POS + attendance preview). **Money contract:** `docs/OPS/MONEY-CONTRACT.md`. **Docs:** `docs/PAYROLL/` |
| Operations Lead | Network-wide role (`operations_lead`): planner + POS + queue (TL∪BA), all branches, My Pay, **no attendance clock**. **Ops Lab** (`/operations/roadmap`) — customizable types/statuses, status notify to all Ops Lab peers, audited actions for SA. |
| Cash advance | Staff request via ops form `cash_advance`. Approve/decline on **Payroll** (not POS). Approved rows feed POS daily close / shift-close (`total_expenses_minor`, cash left). End of shift is a 4-step wizard; **Total sales** = paid POS (legacy key `square_sales_minor`) |
| Expense report | ASA draft/submit → expenses `pending_approval`. SA approve → `pending_payment` (not P&L yet). `approve_paid` or later `mark_paid` → `paid` → P&L. Interface: `review_expense_report` |

## Intentional denorm

Booking rows snapshot customer/vehicle fields at ticket time so floor history does not drift when CRM updates later.
