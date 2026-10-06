# TL / BA Bookings — responsive validation (2026-10-06)

Runner: `BASE_URL=http://localhost:5173 node scripts/_tl-responsive-validation.mjs` (real `tl` + `admin` logins).
Raw: `results.json`, per-viewport folders (`*-full-page.png`, `*-accessibility-tree.txt`, `*-touch-targets.md`).

| | Baseline | After |
|---|---|---|
| Page × viewport checks passing | 21 / 54 | **54 / 54** |

Pages: TL bookings, TL bookings `?stage=maintenance`, TL queue, TL queue/new, TL attendance, BA bookings.
Viewports: 375, 393, 430, 768, 1024, 1280, 1440, 1920, landscape 667×375.
Checks: no horizontal overflow, touch targets ≥44px at ≤1024px, form controls ≥16px on phones (no iOS zoom), no page errors / 5xx / access denied.

## What failed at baseline and was fixed
- Tab triggers, breadcrumb link, notification bell, queue filters/history buttons were under 44px.
- Search input / filter selects were 13–14px on phones (iOS zooms on focus).
- Mobile Bookings pushed status cards below the fold (duplicate meta + guide above the board).

## Known deviations (not gated)
- Dense ops body text is below 16px by design; only form controls are held to 16px.
- Maintenance count shows "…" until its list loads (captured on the 375px shot).
