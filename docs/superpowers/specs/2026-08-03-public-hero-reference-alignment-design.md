# Public Hero Reference Alignment Design

## Goal

Align only the public homepage hero with the approved Hakum visual references. The result should feel like the supplied navy automotive composition: a compact header above a full-viewport vehicle image, an oversized Benzin headline, restrained Gilmer supporting text, a cyan-outlined experience feature card, and a lower milestone row.

## Scope

This change applies only to the hero section rendered by `PublicLandingPage` and its hero-specific styles. The public header and every section below the hero retain their current structure and styling. Operations, administration, authentication, customer account, and other internal interfaces are not changed.

## Desktop Composition

The hero occupies at least one viewport height and uses the existing Hakum vehicle image. Layered navy gradients lower the image contrast and keep white typography legible.

The content is arranged in four visual bands:

1. A small uppercase branch/location label near the upper-left.
2. A centered headline block with the two-line message “Give your car / The pampering it deserves.” The heading uses Benzin ExtraBold, uppercase lettering, tight line height, and a controlled italic/skew treatment matching the reference.
3. A lightweight uppercase Gilmer description followed by two compact pill actions: “Start now” and “Book a service.” Existing destinations remain unchanged.
4. A lower experience composition containing a cyan-outlined “10 Years” feature card on the left and the existing “Experience” heading with four animated milestones across the remaining width.

The existing “Discover” cue remains at the bottom edge when space permits.

## Responsive Behavior

On medium screens, the feature card sits above or alongside a two-column milestone grid depending on available width. On small screens, the headline wraps naturally, the actions stack, the feature card centers, and milestones use two columns. No hero element may cause horizontal scrolling or overlap the fixed header.

The mobile hero may exceed one viewport height to preserve readable spacing. The “Discover” cue may remain hidden at the smallest breakpoint, consistent with the current behavior.

## Typography

- Headline, “Experience,” feature-card value, and milestone values use the self-hosted Benzin family.
- Headline uses the ExtraBold weight; secondary display text uses Semibold or Medium as appropriate.
- Location label, description, buttons, feature-card supporting copy, and milestone labels use the self-hosted Gilmer family.
- Supporting copy remains visually lighter and smaller than the display typography.
- The font treatment is scoped to hero selectors and does not modify typography below the hero.

## Components and Data

`PublicLandingPage` retains its current animated-number behavior, branch-derived location label, links, and milestones. A presentational experience feature card is added within the hero markup. It displays the existing ten-year experience claim and does not introduce a new data dependency.

No backend calls, Supabase schema changes, route changes, or content-management work are required.

## Accessibility

Heading order remains valid: the hero message is the page `h1`, and “Experience” remains the following `h2`. Decorative image and gradient layers stay hidden from assistive technology. Link text remains explicit, focus styles remain visible, and contrast must be maintained against the darkest part of the image treatment. Motion remains limited to the existing milestone count-up behavior.

## Verification

- Add or update focused source-level tests to require the hero feature card and hero-only styling hooks.
- Run the public branding and Supabase configuration tests.
- Run lint against every changed JavaScript or JSX file.
- Build the production bundle.
- Inspect the hero at desktop and mobile viewport sizes in localhost, confirming hierarchy, wrapping, contrast, and lack of overflow.

## Acceptance Criteria

- The homepage hero clearly matches the supplied navy automotive reference in composition and typographic hierarchy.
- Benzin is visibly dominant for display text while Gilmer remains restrained for supporting text.
- The feature card, experience heading, and four existing milestone values are present in the lower hero.
- The fixed header and all content below the hero remain structurally and visually unchanged.
- The hero is usable without horizontal scrolling on desktop, tablet, and mobile widths.
- Existing hero links, branch label behavior, metric animation, and accessibility semantics continue to work.
