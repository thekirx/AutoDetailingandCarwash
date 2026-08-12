# Ops chrome matrix

Hakum operations uses **exactly two** chrome systems. Do not add a third.

## CommandShell (web-first)

| Role | Notes |
|------|--------|
| Super Admin (`BossMich`) | Full sidebar |
| Assistant Super Admin | Grant-filtered sidebar |
| Branch Admin (`admin`) | Branch-scoped sidebar; POS primary CTA |
| Investor | Slim: Finance + Reports only |

**Pattern:** collapsible inset sidebar, Hakum wordmark, notifications + settings in topbar. Dense SaaS tables OK. Mobile = drawer, not phone stage.

## FloorAppShell (mobile-app-first)

| Role | Primary dock |
|------|----------------|
| Team Lead | Wash / Detail / New / Floor / Attendance |
| Crew (`staff`) | Attendance / Tasks / Planner forms |
| Sales | Bookings / History |
| Marketing | CRM / Bookings / Planner / Notifications |
| Video editor | Calendar / Tasks |
| Detailer | My detailing / Attendance |

**Pattern:** island bottom nav, brand mark topbar, settings + notifications, desktop “phone on bay” stage (~430px) like customer capp. Safe-area aware.

## Brand tokens

- Primary: `#052699`
- Page: `#f1f1ed`
- Cinematic: `#020a31`
- Fonts: Benzin (display), Gilmer (body/UI)
- Logos: `/branding/hakum-mark-ow.png`, `/branding/hakum-lw-ow.png`

## Nav source of truth

All docks and sidebars are built from `src/auth/permissions.js` only.
