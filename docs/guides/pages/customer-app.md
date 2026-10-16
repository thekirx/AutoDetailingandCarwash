# Customer app

**Routes:** `/account`, `/account/book`, `/account/queue`, `/account/blog`, `/account/loyalty`, `/account/more`, `/account/events`, `/account/visit`, `/account/visit/:id`, `/signin`, `/signup`, `/account/set-password`  
**Shell:** `.capp` + HakumAuthShell (auth)  
**Role guide:** [`../roles/customer.md`](../roles/customer.md) · **Shop-day:** walk-in → signup history · sold car: staff [`vehicle-transfer.md`](./vehicle-transfer.md)

## Purpose
Loyalty home, book, garage, live queue, visit progress, content, auth. Garage and book auto-fill car size from the Cars catalog; the customer can override.

## Walk-in → signup history

If the shop already took a visit on this phone with no Hakum account, `/signup` attaches those tickets and the account home shows: **You have existing history with us.**  
If attach fails, the account is still created and a softer warning is shown instead (see `HISTORY_ATTACH_WARNING`).  
Staff move a sold car on [`vehicle-transfer.md`](./vehicle-transfer.md) — past visits stay on the seller.

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
