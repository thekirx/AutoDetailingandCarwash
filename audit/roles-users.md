# Roles & users inventory

Living roster for the Hakum principal audit. Refresh from live when People/Auth change.

**Live checked:** 2026-08-21 (Slice V hospitality) · project `lybxhpzzqqyqswvuwpxv`  
**Active staff:** 14 (BossMich 1, ASA 1, admin 2, TL 2, sales 1, staff 3, marketing 1, detailer 1, video 1, investor 1)  
**Active customers:** 16  
**Custom roles:** `role_definitions` table (Option A); assignees keep `profile_role` + optional `custom_role_key`

## Role catalog (app `ROLES`)

| Role key | Label | Shell | Home | Demo chip | Live active (non-archived) |
|----------|-------|-------|------|-----------|----------------------------|
| `BossMich` | Super Admin | Command | `/operations/console` | boss | BossMich |
| `assistant_super_admin` | Assistant Super Admin | Command | `/operations/console` | asa | Assistant Super Admin |
| `admin` | Branch Admin | Command | `/operations/pos` | admin | Branch Admin, Site Admin |
| `team_lead` | Team Lead | FloorApp | `/operations/queue` | tl | TL Test Account (bacoor), TL Batangas |
| `sales` | Sales | FloorApp | `/operations/bookings` | sales | Sales Desk |
| `staff` | Crew | FloorApp | `/operations/attendance` | crew1–3 | Crew One/Two/Three |
| `marketing` | Marketing | FloorApp | `/operations/crm` | marketing | Marketing Lead |
| `detailer` | Detailer | FloorApp | `/operations/queue?family=detailing` | detailer | Demo Detailer |
| `video_editor` | Video Editor | FloorApp | `/operations/planning?tab=calendar` | video | Demo Video Editor |
| `investor` | Investor | Command | `/operations/finance` | investor | Demo Investor |

**Deprecated (do not assign):** `cashier` — still redirects to POS if present in DB.

## Customer portal

| Persona | Demo | Live |
|---------|------|------|
| Customer | `demo.customer@hakumautocare.com` | Present (`customers` + `auth.users`) |
| Other customers | — | ~16 active / 21 total CRM rows (includes QA/sample) |

## Live staff roster (active, not archived)

| Name | Role | Auth email | Branch |
|------|------|------------|--------|
| BossMich | BossMich | bossmich@hakumautocare.com | all |
| Assistant Super Admin | assistant_super_admin | assistant@hakumautocare.com | all |
| Branch Admin | admin | admin@hakumautocare.com | bacoor |
| Site Admin | admin | admin2@hakumautocare.com | bacoor |
| TL Test Account | team_lead | teamlead@hakumautocare.com | bacoor |
| TL Batangas | team_lead | tl.batangas@hakumautocare.com | batangas |
| Sales Desk | sales | sales@hakumautocare.com | all (role scope) |
| Crew One | staff | staff1@hakumautocare.com | bacoor |
| Crew Two | staff | staff2@hakumautocare.com | bacoor |
| Crew Three | staff | staff3@hakumautocare.com | bacoor |
| Marketing Lead | marketing | marketing@hakumautocare.com | bacoor |
| Demo Detailer | detailer | detailer@hakumautocare.com | bacoor |
| Demo Video Editor | video_editor | video@hakumautocare.com | bacoor |
| Demo Investor | investor | investor@hakumautocare.com | all (read) |

**Archived QA staff (inactive):** Crew CRUD Edited, QA Crew, testngani, testtest, testulit, Verify Crew Edited — leave archived.

## Access snapshot (high level)

| Role | POS | Finance | Payroll | Queue edit | People | CRM | Notes |
|------|-----|---------|---------|------------|--------|-----|-------|
| SA | yes | yes | yes | yes | yes | yes | Data Center |
| ASA | grant | grant | grant | grant | grant | grant | Defaults in `DEFAULT_ASSISTANT_GRANTS` |
| BA | yes | no (nav) | no | view | no | no | `BRANCH_ADMIN_ROUTE_KEYS` |
| TL | no | no | no | yes | no | no | Floor dock |
| Sales | no | no | no | no | no | no | Bookings + history |
| Staff | no | no | no | no | no | no | Attendance + tasks + pay |
| Marketing | no | no | no | no | no | yes | CRM + bookings |
| Detailer | no | no | no | detailing view | no | no | Family locked |
| Video | no | no | no | no | no | no | Calendar + tasks |
| Investor | no | view | no | no | no | no | Finance + reports only |

## Secondary live accounts (no demo chip)

| Name | Role | Auth email | Notes |
|------|------|------------|-------|
| Site Admin | admin | admin2@hakumautocare.com | Extra BA; not in `OPS_DEMO_ACCOUNTS` |
| TL Batangas | team_lead | tl.batangas@hakumautocare.com | Second branch TL; password not in floor seed |

Use People → temporary password if you need chip-less accounts for QA.

## Live demo login smoke (Slice M)

`node scripts/_qa-live-smoke.mjs` — **21/21 pass** (2026-08-20): boss + ASA + all primary demo roles + crew1–3 + customer.

## Demo testing ergonomics

- Demo chips now support **one-tap auto sign-in** on both team and customer login pages.
- The same guarded login path is reused; chips no longer just prefill the form.
- Auto sign-in is only exposed where `isDemoLoginEnabled()` is true.

## Coverage checks

- Every `ROLES` value has a demo chip in `OPS_DEMO_ACCOUNTS` + live active row.
- Customer demo exists in Auth + `customers`.
- Secondary accounts (admin2, TL Batangas) listed above — chip-less by design.
- QA matrix: `tests/principalQaMatrix.test.js`.
- Login emails backfilled (B-26); geofence RPC revoked (B-28); demo auto sign-in verified in source tests.

## Refresh SQL

```sql
select sp.full_name, sp.role, sp.login_email, u.email as auth_email, sp.branch_slug, sp.is_active
from public.staff_profiles sp
left join auth.users u on u.id = sp.id
where coalesce(sp.is_archived, false) = false
order by sp.role, sp.full_name;
```
