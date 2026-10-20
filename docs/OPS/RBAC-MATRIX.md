# Hakum RBAC matrix (19 Oct 2026)

Source: Sir Michi’s access sheet. This file is the contract. `src/auth/permissions.js` must match it. Do not invent a different matrix.

People listed below are the sheet’s examples of who holds each group. The app role is what the code enforces. Crew, detailer, video editor, and Operations Lead are not on the sheet; their existing docks stay.

## Groups

| Sheet group | App role | Branch scope |
|---|---|---|
| Owner (Michihiko) | `BossMich` | All branches |
| Super Admin (Robert) | `BossMich` | All branches |
| General Admin (Lucy) | `assistant_super_admin` | All branches |
| Team Lead (Bryan, Jaycee, Rox, Kyle, Rovi) | `team_lead` | That branch only (Bacoor, Dasmarinas, Batangas) |
| Branch Admin (Peter, Jessica, Sam, Almirra) | `admin` | That branch only |
| Marketing (Bryan, Ron) | `marketing` | All branches |
| Customer Rep (Dummy Account) | `sales` | All branches |
| Investor | `investor` | The branch on the account |

Owner and Super Admin are the same access. Both use `BossMich`. People shows **Owner / Super Admin**. General Admin shows as **General Admin**. `sales` shows as **Customer Rep**. `admin` shows as **Branch Admin**.

Creating a General Admin in People stores `finance_write` and `planning_edit` as on. An old account with those grants left off stays off until someone turns them on. Marketing and Customer Rep do not pick a branch.

## Columns

`Full` = open and change. `Read` = open, no writes. `None` = no route.

| Column | Owner / Super Admin | General Admin | Team Lead | Branch Admin | Marketing | Customer Rep | Investor |
|---|---|---|---|---|---|---|---|
| Floor Board | Full | None | None | None | None | None | None |
| Car Wash Queue | Full | Full | Full | Read | Read | Read | Read |
| Detailing Schedule | Full | Full | Full | Read | Read | Read | Read |
| Team Planner | Full | Full | Partial | Partial | Partial | Partial | None |
| Point of Sales | Full | Full | None | Full | None | None | Read |
| Vouchers | Full | Full | None | None | None | None | Read |
| Financials | Full | Full | None | Full | None | None | Read |
| Human Resource | Full | Full | Read | Full | None | None | None |
| Customers | Full | Full | Read | Create / modify | Read | Create / modify + reports | None |

**Partial planner** means the person uses Team Planner and cannot open a board whose name is Cash advance. Owner, Super Admin, and General Admin still see that board. Board delegation is that hide (`hidesCashAdvancePlannerBoard`). Category `visible_roles` is separate (C13).

**Vouchers column** is the voucher board. Team Lead still types a promo code on a queue ticket (C16). They do not open `/operations/vouchers`.

**Customers “create reports”** for Customer Rep is CRM create/modify, not the Finance reports tab. Customer Rep has no Financials.

**Human Resource read** for Team Lead is the attendance register without override. Marketing, Customer Rep, and Investor have no attendance page.

## Database

App gates are not enough: the browser writes `bookings` with the signed-in user. Migration `20261019180000_rbac_sheet_write_locks` is the lock.

- Branch Admin cannot insert or update bookings, queue assignments, or queue events. Attendance and POS stay on `can_manage_branch`.
- Customer Rep cannot write bookings. They can insert and update customer rows, and `QUEUE_PROVISION_ROLES` includes `sales` so CRM register works.
- Planner boards use `plan_boards.visible_roles` (empty = everyone). Cash Advance boards are seeded so Team Lead, Branch Admin, Marketing, and Customer Rep do not see them. Configure → Save board edits the allowlist. Legacy name match still applies only when `visible_roles` is empty.
- Marketing cannot update customers, write vehicles, insert customer notes, or write `sms_events`.
- Campaign SMS (`canSendCustomerSms`) is Owner / Super Admin, General Admin with CRM, and Branch Admin. Customer Rep edits the customer file and does not open the SMS tab.

## People

`/operations/people` labels match the sheet (`src/auth/internalRoles.js`). The picker shows that role’s access. Marketing and Customer Rep have no branch picker. A new General Admin stores `finance_write` and `planning_edit` on. Existing General Admin rows are not rewritten.

## Crew (not on the sheet)

Crew (`staff`) still clocks in, opens My Tasks, Floor Board watch, and Planner Forms + Tasks. Do not apply the sheet’s “no Floor Board” rule to crew.
