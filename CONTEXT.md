# Hakum Auto Care — domain glossary

Short vocabulary for audits and architecture reviews. Expand as seams deepen.

| Term | Meaning |
|------|---------|
| Floor | Live queue board + ticket lifecycle (waiting → … → payment) |
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
| Shop-day settlement | Wash pool (`washPoolAmountMinor`) + ceramic job drafts (`buildCeramicCompensationExpenses`) + daily close buckets. Branch scope is `getBranchScopeList`. Close skips ceramic/payroll drafts until paid |
| Payroll run | SA/ASA wizard: POS paid sales + attendance → `payroll_runs` / `payroll_run_lines` / `payroll_run_sales`. Interface: `src/lib/payroll.js`. Employees (not Super Admin) read own lines on My pay. Wash-pool salary posts only from Payroll confirm; Crew tab is estimate-only |

## Intentional denorm

Booking rows snapshot customer/vehicle fields at ticket time so floor history does not drift when CRM updates later.
