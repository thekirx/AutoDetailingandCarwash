# Ops chrome matrix

Hakum operations uses **exactly two** chrome systems. Do not add a third.

Full design system: [docs/design-system/README.md](design-system/README.md) · Role guides: [docs/guides/roles/](guides/roles/) · Page guides: [docs/guides/pages/](guides/pages/)

## CommandShell (web-first)

| Role | Notes |
|------|--------|
| Super Admin (`BossMich`) | Full sidebar |
| Assistant Super Admin | Grant-filtered sidebar |
| Branch Admin (`admin`) | Branch-scoped sidebar; POS primary CTA |
| Operations Lead | Network ops; Queue home (no Floor Board); CRM view only |
| Investor | Slim: Finance only |

**Pattern:** collapsible inset sidebar, Hakum wordmark, breadcrumbs + Cmd/Ctrl+K + notifications + account in topbar. Dense SaaS tables OK. Mobile = drawer, not phone stage. Both shells wrap `<Outlet />` in `OpsErrorBoundary` and resolve unknown `/operations/*` routes to `OpsNotFoundPage`.

## FloorAppShell (mobile-app-first)

| Role | Primary dock (More in Permissions) |
|------|----------------|
| Team Lead | Queue / Bookings / POS / Tasks (More: Attendance, Dashboard, Advances, Payslips, KPI, Forms) |
| Crew (`staff`) | Attendance / Tasks / Advances (More: Payslips) |
| Sales | Bookings / History (More: Queue, CRM, Notifications, Payslips) |
| Marketing | CRM / Bookings / Notifications / Rewards (More: Queue, Planner, Content, Inquiries, Payslips) |
| Video editor | Planner / Content (More: Attendance, Payslips) |
| Detailer | Bookings / Attendance / Tasks (More: Payslips) |

**Pattern:** island bottom nav (max 5), brand mark topbar, settings + notifications. Phone: single column. Tablet 768+: left icon rail + 2-col (not stretched phone UI). Desktop: same rail, `max-w-5xl`. Safe-area aware.

## Brand tokens

- Primary: `#052699`
- Page: `#f1f1ed`
- Cinematic: `#020a31`
- Fonts: Benzin (display), Gilmer (body/UI)
- Logos: `/branding/hakum-mark-ow.png`, `/branding/hakum-lw-ow.png`

See [design-system/01-foundations.md](design-system/01-foundations.md).

## Nav source of truth

All docks and sidebars are built from `src/auth/permissions.js` only.
