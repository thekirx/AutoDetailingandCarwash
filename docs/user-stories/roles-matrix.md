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

**Deprecated:** `cashier` still redirects to POS for legacy rows — do not hire new cashiers.

**Seam:** `redirectForRole` · `resolveAppHome` · `tests/principalQaMatrix.test.js` · `tests/rolePersonaCoverage.test.js`

## Who never clocks / never pays on floor

| Persona | Attendance clock | My Pay | Payroll register |
|---------|------------------|--------|------------------|
| Super Admin | No | No (uses Payroll) | Yes |
| ASA | No (unless grant) | Yes | View / write by grant |
| Ops Lead | **No clock** (register ok) | Yes | No |
| Investor | No | No | No |
| Customer | N/A | N/A | N/A |
