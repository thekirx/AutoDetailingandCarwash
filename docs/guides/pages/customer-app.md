# Customer app

**Routes:** `/account`, `/account/book`, `/account/queue`, `/account/blog`, `/account/loyalty`, `/account/more`, `/account/events`, `/signin`, `/signup`  
**Shell:** `.capp` + HakumAuthShell (auth)

## Purpose
Loyalty home, book, garage, live queue, visit progress, content, auth.

## Layout
```
[Safe-area top]
[Brand + greeting / active visit]
[Sections]
[Island dock — 5 tabs]
```

## Nav (dock)

Home · Book · Queue · Blog · More  
Secondary: Events, Loyalty (tiles / More).

## Components
CustomerAppFrame, CustomerAccountDock, ActiveVisitCard, VisitProgress, CustomerUi primitives.

## Theme
Light default + dark via `html.dark` (More → Light/Dark). Dual brand lockups.

## Responsive
Mobile-first app shell; ≥860px landing header + wide stage (not phone-on-bay). Landscape side dock. Evidence: `docs/qa/responsive-report.md`.
