# Public Homepage Reference Alignment Design

## Goal

Align the public homepage Hero, About Us, and Services sections with the approved Hakum visual references. The result should reproduce their navy automotive composition, oversized Benzin display typography, restrained Gilmer supporting text, editorial image treatment, and strong blue-and-white section layouts.

## Scope

This change applies only to the Hero, About Us, and Services sections rendered by `PublicLandingPage` and their section-specific styles. Homepage sections after Services retain their current structure and styling. The public header, operations, administration, authentication, customer account, and other internal interfaces are not changed.

## Desktop Composition

The hero occupies at least one viewport height and uses the existing Hakum vehicle image. Layered navy gradients lower the image contrast and keep white typography legible.

The content is arranged in four visual bands:

1. A small uppercase branch/location label near the upper-left.
2. A centered headline block with the two-line message “Give your car / The pampering it deserves.” The heading uses Benzin ExtraBold, uppercase lettering, tight line height, and a controlled italic/skew treatment matching the reference.
3. A lightweight uppercase Gilmer description followed by two compact pill actions: “Start now” and “Book a service.” Existing destinations remain unchanged.
4. A lower experience composition containing a cyan-outlined “10 Years” feature card on the left and the existing “Experience” heading with four animated milestones across the remaining width.

The existing “Discover” cue remains at the bottom edge when space permits.

## About Us Composition

The About Us section follows the approved blue editorial reference. A deep brand-blue background contains a small “Our story · Since 2024” eyebrow and an oversized white Benzin “About Us” heading spanning most of the content width.

Below the heading, the content uses a balanced two-column composition. A tall automotive photograph occupies the left side. A white editorial panel occupies the right side with a larger introductory sentence, supporting paragraphs, and a compact “Meet your nearest branch” action. Benzin is reserved for the dominant heading and selected emphasis; Gilmer carries the readable long-form copy and action text.

On mobile, the image and content panel stack while preserving a clear relationship between the heading, photograph, and story copy.

## Services Composition

The Services section follows the approved vivid-blue card-grid reference. Its introduction uses a large stacked Benzin heading on the left and a lightweight Gilmer description on the right.

Eight existing services remain in the same order and are presented as a four-column by two-row grid on wide screens. Each card contains a large photographic area, a white content area, an italic uppercase Benzin service title, a short Gilmer description, and a minimal booking link. Card borders, spacing, and typography stay crisp and editorial rather than rounded or application-like.

The grid reduces to two columns on tablet and one column on narrow mobile screens. Card image ratios and content heights remain consistent within each breakpoint.

## Responsive Behavior

On medium screens, the feature card sits above or alongside a two-column milestone grid depending on available width. On small screens, the headline wraps naturally, the actions stack, the feature card centers, and milestones use two columns. No hero element may cause horizontal scrolling or overlap the fixed header.

The mobile hero may exceed one viewport height to preserve readable spacing. The “Discover” cue may remain hidden at the smallest breakpoint, consistent with the current behavior. About Us and Services stack without horizontal overflow or compressed body text.

## Typography

- Use only the user-supplied Benzin and Gilmer font files already bundled under `public/fonts`; do not use lookalike, system, or externally hosted substitutes.
- Hero headline, “Experience,” feature-card value, milestone values, “About Us,” the Services heading, and service titles use the supplied Benzin family.
- Major section headings use Benzin ExtraBold; secondary display text and service titles use Benzin Semibold or Medium as appropriate.
- Location label, descriptions, buttons, feature-card supporting copy, milestone labels, About Us paragraphs, and service-card descriptions use the supplied Gilmer family, primarily Light, Regular, and Medium.
- Supporting copy remains visually lighter and smaller than the display typography.
- The new font treatment is scoped to the Hero, About Us, and Services selectors and does not modify later homepage sections or other pages.

## Components and Data

`PublicLandingPage` retains its current animated-number behavior, branch-derived location label, links, milestones, About Us content, services, and booking destinations. A presentational experience feature card is added within the hero markup. It displays the existing ten-year experience claim and does not introduce a new data dependency.

No backend calls, Supabase schema changes, route changes, or content-management work are required.

## Image Workflow

Layout and styling are implemented first using existing project imagery as temporary content. After the user uploads the final reference and source photographs, image replacement, object positioning, crop selection, and per-card visual matching are completed as the last implementation step. This deferral does not permit changes to the approved section structure or typography hierarchy.

## Accessibility

Heading order remains valid: the hero message is the page `h1`, and “Experience” remains the following `h2`. Decorative image and gradient layers stay hidden from assistive technology. Link text remains explicit, focus styles remain visible, and contrast must be maintained against the darkest part of the image treatment. Motion remains limited to the existing milestone count-up behavior.

## Verification

- Add or update focused source-level tests to require the hero feature card and the scoped Hero, About Us, and Services styling hooks.
- Run the public branding and Supabase configuration tests.
- Run lint against every changed JavaScript or JSX file.
- Build the production bundle.
- Inspect all three sections at desktop and mobile viewport sizes in localhost, confirming hierarchy, wrapping, contrast, card-grid behavior, and lack of overflow.
- After final photographs are provided, inspect every image crop against its corresponding reference.

## Acceptance Criteria

- The Hero, About Us, and Services sections clearly follow the supplied reference pictures in composition, proportions, colors, typographic hierarchy, and editorial character.
- Benzin is visibly dominant for display text while Gilmer remains restrained for supporting text.
- The feature card, experience heading, and four existing milestone values are present in the lower hero.
- About Us uses the approved oversized heading, tall image, and white story-panel composition.
- Services presents all eight existing items in the approved image-led editorial card grid.
- The fixed header and all homepage content after Services remain structurally and visually unchanged.
- All three sections are usable without horizontal scrolling on desktop, tablet, and mobile widths.
- Existing links, branch label behavior, metric animation, content, and accessibility semantics continue to work.
