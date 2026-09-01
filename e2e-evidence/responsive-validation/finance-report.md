# Responsive Validation Report

**Pages validated:** Finance (`/operations/finance`)
**Viewports tested:** CSS/layout review against matrix (375–1920)
**Date:** 2026-08-24

## Design choices (responsive)

- Shell uses `overflow-x: clip` and `minmax(0, …)` grids to prevent horizontal scroll
- Filter bar stacks on mobile (`position: static` under 640px); sticky on desktop
- Tab rail is horizontal-scroll with 44px min touch targets
- KPI grid: 2 columns → 4 at 900px
- Charts/content: single column → 2fr/1fr at 1024px
- Quick links: 1 → 3 columns at 640px
- Refresh / net chip full-width on small phones

## Viewport Results

| Viewport | Layout | Touch | Typography | Content | Verdict |
|----------|--------|-------|------------|---------|---------|
| 375px | OK (stack + scroll tabs) | OK (≥44px tabs/refresh) | OK (0.9375rem lead) | OK (all tabs reachable) | PASS |
| 393px | OK | OK | OK | OK | PASS |
| 430px | OK | OK | OK | OK | PASS |
| 768px | OK | OK | OK | OK | PASS |
| 1024px | OK (2-col charts) | OK | OK | OK | PASS |
| 1280px | OK | N/A | OK | OK | PASS |
| 1440px | OK | N/A | OK | OK | PASS |
| 1920px | OK | N/A | OK | OK | PASS |

## Issues Found

None blocking. Sticky filters disabled under 640px so mobile scroll chrome does not trap the bar under the ops header.

## Overall Verdict: PASS
