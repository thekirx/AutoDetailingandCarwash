# Hakum Design System

Source of truth for every app surface: Command shell (admins), Floor shell (staff), Customer PWA.

Marketing pages (`/home`, `/services`, `/packages`, blog, legal) are **out of scope** for visual redesign; they share fonts and brand tokens only.

## How to use

1. Read this README + [01-foundations](01-foundations.md) before changing UI.
2. Pick components from [02-components](02-components.md); do not invent one-off cards.
3. Follow [03-patterns](03-patterns.md) for page anatomy and states.
4. Match shell + breakpoints in [04-shells-responsive](04-shells-responsive.md).
5. Run [05-accessibility-checklist](05-accessibility-checklist.md) before shipping.

Role workflows: [`docs/guides/roles/`](../guides/roles/).  
Page specs: [`docs/guides/pages/`](../guides/pages/).  
Ops chrome matrix: [`docs/ops-chrome.md`](../ops-chrome.md).

## Design dials

| Surface | Variance | Motion | Density |
|---------|----------|--------|---------|
| Command shell (admin) | 3 | 2 | 7 |
| Floor shell (staff/TL) | 3 | 2 | 7 |
| Customer PWA | 5 | 4 | 4 |

## Decision log

| Decision | Choice |
|----------|--------|
| Brand | Navy `#052699`, page `#f1f1ed`, cinematic `#020a31` |
| Fonts | Benzin (display/brand), Gilmer (all UI). No Geist. |
| Icons | `lucide-react` only, stroke 1.75 |
| Components | Existing shadcn/Radix kit; no new deps |
| Tables | Thin `DataTable` over shadcn Table (no TanStack) |
| Sheets | shadcn `Sheet side="bottom"` on mobile |
| Theme | Light-first, dark via semantic tokens (no `html:not(.dark)` text rewrites) |
| Shells | Exactly two ops shells + customer `capp` |
| Nav | `src/auth/permissions.js` only |

## One system per shell

- **CommandShell** — desktop-first sidebar SaaS.
- **FloorAppShell** — phone/tablet dock; tablet gets left rail + 2-col, not a stretched phone frame.
- **Customer capp** — mobile-first PWA; desktop keeps phone-on-bay stage.

Do not add a third ops chrome system.
