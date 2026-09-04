# Shells and responsive

## Breakpoints

| Name | Width | Use |
|------|-------|-----|
| Phone | < 768 | Floor dock, capp dock |
| Tablet | 768–1279 | Floor left rail + 2-col |
| Desktop | ≥ 1280 | Command sidebar; Floor max-w-5xl rail layout |
| Wide | ≥ 1440 | Same, more table columns |

Customer capp: desktop keeps phone-on-bay (~430px) stage.

## CommandShell

Roles: Super Admin, ASA, Branch Admin, Operations Lead, Investor.

- Collapsible inset sidebar (groups: Floor / Counter / Customers / Books / Work / Company)
- Topbar: trigger, brand, breadcrumbs, Cmd/Ctrl+K, NotificationBell, account menu
- < 1024: sidebar = drawer
- Content: `max-w-7xl`, density 7
- No phone stage

## FloorAppShell

Roles: Team Lead, Staff, Sales, Marketing, Detailer, Video Editor.

- Topbar: brand mark, branch/shift meta, notifications, settings
- Dock: max 5 items, 56px + `env(safe-area-inset-bottom)`, active item labelled
- More → bottom Sheet
- Phone (<768): single column
- Tablet (768+): left icon rail + 2-column content (not stretched phone UI)
- Desktop (1280+): same rail layout, `max-w-5xl` (phone-on-bay retired for floor)

## Customer capp

- Classes: `.capp` / `.capp-stage` / `.capp-dock` only (no parallel `.account-*` chrome)
- Dock: Home / Blog / Events / Queue (≤4)
- Safe areas: `padding-top: max(1.1rem, env(safe-area-inset-top))`, bottom dock clears inset
- Dynamic Island / notch: never put primary CTA under status bar
- Sheets for settings and secondary actions
- Desktop: phone stage on cinematic bay

## Touch

- Targets ≥ 44×44 CSS px
- Gap ≥ 8px between targets
- Prefer press feedback `scale-[0.98]` / active opacity

## Viewport units

Prefer `100dvh` / `min-h-[100dvh]` over `100vh`. `viewport-fit=cover` in `index.html`.

## TV / kiosk

`PublicQueueTvPage` — large type, high contrast, no dock, auto-refresh. Separate from floor shell.
