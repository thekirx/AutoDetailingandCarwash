# Hakum Ops — User Stories

Product backlog for daily operations, money, books, and **every staff + customer persona**.  
Each epic links acceptance criteria to seam tests in `tests/`.

**Owner share (HTML + PDF, plain language, no flowcharts):** [OWNER-SHARE.md](./OWNER-SHARE.md)

**Everyone included:** [roles-matrix.md](./roles-matrix.md)

## Money path (shop day)

| Epic | File | Primary roles |
|------|------|---------------|
| Daily floor operations | [epic-daily-operations.md](./epic-daily-operations.md) | Crew, Team Lead, Branch Admin, Sales |
| End of shift & close | [epic-shift-close.md](./epic-shift-close.md) | Branch Admin, ASA, Super Admin |
| Payroll & compensation | [epic-payroll.md](./epic-payroll.md) | Super Admin, ASA, Crew |
| Late, absent, CA, commissions | [epic-commissions-attendance.md](./epic-commissions-attendance.md) | Super Admin, Branch Admin, Crew, Detailer |
| Finance & books | [epic-finance.md](./epic-finance.md) | Super Admin, ASA, Investor |

**Locked path map:** [shop-day-flow.md](./shop-day-flow.md) · Money contract: `docs/OPS/MONEY-CONTRACT.md`

## Persona epics (100% role coverage)

| Persona | File |
|---------|------|
| Super Admin · ASA · Investor | [epic-role-leadership.md](./epic-role-leadership.md) |
| Branch Admin | [epic-role-branch-admin.md](./epic-role-branch-admin.md) |
| Team Lead | [epic-role-team-lead.md](./epic-role-team-lead.md) |
| Crew (`staff`) | [epic-role-crew.md](./epic-role-crew.md) |
| Operations Lead | [epic-role-operations-lead.md](./epic-role-operations-lead.md) |
| Video Editor | [epic-role-video-editor.md](./epic-role-video-editor.md) |
| Detailer · Sales · Marketing | [epic-roles-detailer-sales-marketing.md](./epic-roles-detailer-sales-marketing.md) |
| Customer (+ guest queue) | [epic-customer-portal.md](./epic-customer-portal.md) |

## Page / capability epics

| Epic | File |
|------|------|
| People & staff accounts | [epic-people.md](./epic-people.md) |
| Attendance register | [epic-attendance.md](./epic-attendance.md) |
| Planner & My Tasks | [epic-planner.md](./epic-planner.md) |
| CRM, inventory & catalog | [epic-crm-inventory.md](./epic-crm-inventory.md) |
| Notifications, inquiries & reviews | [epic-notifications-inquiries.md](./epic-notifications-inquiries.md) |
| Ops Lab, Data Center, Console | [epic-ops-lab-console.md](./epic-ops-lab-console.md) |
| Remaining pages (KPI, History, Memberships, Settings, Audit, Content) | [epic-remaining-ops-pages.md](./epic-remaining-ops-pages.md) |

## Definition of Done (any story)

- Route gate + RLS match (`permissions.js`, migrations)
- UI wired to real tables/RPCs (no fake buttons)
- Seam test at the public interface (`tests/*Seam*.test.js`, `tests/dailyOps*.test.js`, `tests/userStoriesCoverage.test.js`, `tests/rolePersonaCoverage.test.js`)
- Money stories also honor `docs/OPS/MONEY-CONTRACT.md`
- Persona stories list home path from `redirectForRole` / `resolveAppHome`

## Sprint cadence (shop day)

1. **Morning** — Attendance + queue/bookings intake  
2. **Day** — POS payments, expenses, ceramic drafts  
3. **Night** — End of shift → Finance accept → Payroll floor confirm  
