# Responsive validation — customer live queue pin

**Pages:** `/account/queue`, `/account` live-queue block
**Viewports:** 375, 393, 768, 1440, landscape 667×375
**Date:** 2026-09-28

## Viewport results

| Viewport | Layout | Touch | Typography | Content | Verdict |
|----------|--------|-------|------------|---------|---------|
| 375px | OK, no horizontal overflow | Buttons 45–47px, 16px type | OK | Pin, nearest branch, other branches | PASS |
| 393px | OK | 45–47px | 16px | Same | PASS |
| 768px | OK | 47px | 16px | Same | PASS |
| 1440px | OK | n/a | 16px | Nearest Bacoor from saved pin | PASS |
| 667×375 landscape | OK | 47px | 16px | Same | PASS |

## Behavior

- Saved pin near Bacoor opens the queue on Bacoor (`?branch=bacoor`) and reads “Nearest branch · 1.6 km from your pin”.
- “Update location” with the device at Batangas switches the queue to Batangas (`?branch=batangas`, “1 m”).
- Home live queue uses the same pin and shows “Nearest to you” plus Batangas.
- Map sheet fits a 390px width (16px inset). Close, “Use my location”, and “Use this pin” are at least 44px.

## Overall verdict: PASS
