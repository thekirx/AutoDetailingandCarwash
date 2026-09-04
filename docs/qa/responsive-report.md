# Responsive Validation Report

**Date:** 2026-09-04
**Pages:** customer app (signin, home, book, queue, loyalty, blog, events, more/garage/alerts)
**Viewports:** 375, 430, 768, 1440, 667×375 landscape + light/dark themes
**Overall verdict:** PASS

## Theme matrix (phone-375)

| Theme | Screen | Overflow | Brand lockup | Progress bar | Add a car | Touch |
|-------|--------|----------|--------------|--------------|-----------|-------|
| light | home | 0 | 168×46 | empty state | yes (CTA) | OK |
| light | home + active visit | 0 | 168×46 | yes | n/a | OK |
| light | garage `?add=1` | 0 | n/a | n/a | form open | OK |
| dark | home | 0 | 168×46 | empty state | yes | OK |
| dark | home + active visit | 0 | 168×46 | yes (Queued→Payment) | n/a | OK |
| dark | garage `?add=1` | 0 | n/a | n/a | form open | OK |

Evidence: `e2e-evidence/customer-app/phone-375-{light|dark}-*.png`, `desktop-1440-{light|dark}-home.png`.

## Checks

- [x] No horizontal overflow at tested widths
- [x] Bottom dock clears CTAs (`padding-bottom` ≥ 6.75rem + safe-area)
- [x] Primary buttons ≥ 44px tall; pills ≥ 2.75rem
- [x] Visit progress bar renders whenever an active booking exists (`ActiveVisitCard` + `VisitProgress`, portal `buildVisitProgress`)
- [x] Add a car on home empty state + garage deep-link `?tab=garage&add=1`
- [x] Light (`html` default) and dark (`html.dark`) token sets with AA-oriented ink/btn contrast
- [x] Dual brand lockups (blue on light, OW on dark) with square-PNG crop (`scale(1.7)`)

## Overall Verdict: PASS
