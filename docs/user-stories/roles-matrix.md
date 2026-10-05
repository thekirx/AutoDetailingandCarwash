# Roles matrix (every persona)

Canonical landing + epic map for **all** `ROLES` in `src/auth/permissions.js`, plus **customer** (portal, not an ops role).

| Role slug | Display | Home after login | Primary epic(s) |
|-----------|---------|------------------|-----------------|
| `BossMich` | Super Admin | `/operations/console` | [Leadership](./epic-role-leadership.md), money path |
| `assistant_super_admin` | ASA | `/operations/console` | [Leadership](./epic-role-leadership.md), grants in [People](./epic-people.md) |
| `admin` | Branch Admin | `/operations/pos` | [Branch Admin](./epic-role-branch-admin.md) |
| `operations_lead` | Operations Lead | `/operations/roadmap` | [Ops Lead](./epic-role-operations-lead.md) |
| `team_lead` | Team Lead | `/operations/queue` | [Team Lead](./epic-role-team-lead.md) |
| `staff` | Crew | `/operations/attendance` | [Crew](./epic-role-crew.md) |
| `sales` | Sales | `/operations/bookings` | [Detailer / Sales / Marketing](./epic-roles-detailer-sales-marketing.md) |
| `marketing` | Marketing | `/operations/crm` | [Detailer / Sales / Marketing](./epic-roles-detailer-sales-marketing.md) |
| `detailer` | Detailer | `/operations/bookings` | [Detailer / Sales / Marketing](./epic-roles-detailer-sales-marketing.md) |
| `video_editor` | Video Editor | `/operations/planning?tab=calendar` | [Video Editor](./epic-role-video-editor.md) |
| `investor` | Investor | `/operations/finance` | [Leadership](./epic-role-leadership.md) · [Finance US-FIN-04](./epic-finance.md) |
| `customer` *(portal)* | Customer | `/account` | [Customer portal](./epic-customer-portal.md) |

**POS settings write** (`canWritePosSettings`): Super Admin, or ASA with `finance_write`. Branch Admin rings the counter; the Settings tab is hidden.

**Payroll settings write** (`canRunPayroll`): Super Admin, or ASA with `finance_write`. Same gate as confirming a run — view-only ASA cannot change late-pay / pending-floor policy.

**Finance books:** default window is last 30 days; Reports/Quotes/Vendors/Categories sit under More (not merged into P&L). Ledgers export CSV; Dashboard still has CSV/Excel/PDF. Commission % stays on Payroll — Categories “Payroll / salary” is a P&L bucket only.

**Deprecated:** `cashier` still redirects to POS for legacy rows — do not hire new cashiers.

**Seam:** `redirectForRole` · `resolveAppHome` · `tests/principalQaMatrix.test.js` · `tests/rolePersonaCoverage.test.js`

## Who clocks / who settles pay

| Persona | Attendance clock | Daily Sheet / pay |
|---------|------------------|-------------------|
| Super Admin | No | Approves sheets; sees all branches |
| ASA | No (unless grant) | Approves if `finance_view` |
| Branch Admin | Optional | **Submits** Daily Sheet; releases pay after approve |
| Ops Lead | **No clock** (register ok) | No sheet approve |
| Team Lead / Crew / Detailer | Yes (branch) | Paid when BA sheet is approved |
| Investor | No | Finance read-only |
| Customer | N/A | N/A |

**Retired:** My Pay and floor Payroll register (2026-10-01).
