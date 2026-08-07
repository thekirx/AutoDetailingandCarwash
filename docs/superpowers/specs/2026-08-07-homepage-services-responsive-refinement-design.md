# Homepage Services Responsive Refinement

## Scope

Refine only the homepage Main Services, Other Services modal, and Ceramic Coating Packages sections. Preserve all unrelated homepage sections, content data, navigation, and existing behavior.

## Main Services

- Keep the approved three-card composition and existing images and copy.
- Use fluid type and spacing so the section remains balanced from compact mobile screens through large desktop windows.
- Increase the visual prominence of “Made to turn heads” and the supporting copy relative to the current implementation.
- Keep the SERVICES display title large without clipping, overflowing, or crowding the header at any supported viewport.
- Keep three columns on desktop, use a compact multi-column treatment where space permits, and stack cards on mobile.

## Other Services

- Preserve the full-screen accessible modal, its four service cards, close control, Escape handling, focus trap, focus restoration, and body scroll locking.
- Make every service card informational only.
- Remove all Book Now links and card click actions.
- Use four columns on wide desktop, two columns on tablet and compact desktop, and one column on mobile.
- Allow vertical modal scrolling without horizontal overflow.

## Ceramic Coating Packages

- Keep the editorial intro and three image-backed package panels.
- Reduce the opacity of the blue tint so more original image detail is visible while maintaining readable white copy.
- Replace brittle fixed proportions with fluid container sizing and responsive minimums.
- Prevent the intro heading, vertical package names, descriptions, and inclusions from overlapping or clipping at intermediate window sizes.
- Retain the desktop vertical-label composition when adequate width is available; stack into a readable mobile presentation at narrow widths.

## Accessibility and Interaction

- Preserve semantic headings and descriptive image alternative text.
- Keep modal keyboard behavior intact.
- Informational Other Services cards expose no misleading interactive affordance.
- Text contrast must remain readable after lowering the ceramic overlay opacity.

## Validation

- Add failing source/CSS contracts for the informational modal and responsive rules before production edits.
- Verify desktop, compact desktop/tablet, and mobile viewport sizes in the in-app Browser.
- Check for clipping, overlap, horizontal overflow within the three scoped sections, readable copy, modal scrolling, Escape close, and focus restoration.
- Run the focused tests, full local test suite, targeted lint, and production build.
