# Responsive Validation Report — Queue + Bookings ops shell

**Pages validated:** Queue (`OperationsQueueBoardPage`), Bookings (`BookingBoardPage`)
**Viewports reviewed (code audit):** 375, 393, 430, 768, 1024, 1280, 1440, 1920
**Date:** 2026-08-28

## Changes

- `OpsPageShell` with `max-w-7xl`, Hakum eyebrow, safe-area padding
- Collapsible `OpsGuideCard` — queue guide documents **jobs stay until POS completes**
- shadcn `OpsTabList` (Board / Table on Queue; Board / List / Table / Calendar on Bookings)
- Preserved lane board CSS: `queue-lane-board-fit`, `booking-lane-board`, status chips, touch targets `min-h-11`

## Viewport Results

| Viewport | Layout | Touch | Typography | Content | Verdict |
|----------|--------|-------|------------|---------|---------|
| 375px | OK | OK | OK | OK | PASS |
| 393px | OK | OK | OK | OK | PASS |
| 430px | OK | OK | OK | OK | PASS |
| 768px | OK | OK | OK | OK | PASS |
| 1024px | OK | N/A | OK | OK | PASS |
| 1280px | OK | N/A | OK | OK | PASS |
| 1440px | OK | N/A | OK | OK | PASS |
| 1920px | OK | N/A | OK | OK | PASS |

## Business rule (from floor feedback)

Jobs remain on the Queue board through waiting, in progress, final check, and payment until the sale is **completed and released at POS**. Guide copy and page description reflect this.

## Overall Verdict: PASS
