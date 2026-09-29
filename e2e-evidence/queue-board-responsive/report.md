# Queue board responsive probe

**Date:** 2026-09-21T09:01:00Z  
**Base:** http://localhost:5173  
**Overall:** PASS

| Viewport | Page Δx | Board Δx | Lanes | Chips | Verdict |
|----------|---------|----------|-------|-------|---------|
| mobile-375 | 0 | 0 | 5 | no | PASS |
| mobile-landscape | 0 | 0 | 5 | no | PASS |
| tablet-768 | 0 | 0 | 5 | no | PASS |
| laptop-1280 | 0 | 0 | 5 | no | PASS |
| desktop-1440 | 0 | 0 | 5 | no | PASS |

## Changes verified
- Redundant status card strip removed (counts stay on lane headers)
- Board uses equal-width columns with `overflow-x: clip` (no left/right scroll)
- Narrow panes stack / 2-up; wide panes show all lanes in one row
- Landscape short height tightens board chrome

Evidence screenshots: `e2e-evidence/queue-board-responsive/*.png`
