# PPF Stage and Package Ladder Redesign

## Objective

Replace the current PPF information-stage photograph with the supplied grey pickup image after removing all marketplace text and overlays, and replace the current verbose PPF package cards with the approved Concept 3 protection ladder. The result must work cleanly at desktop, tablet, and mobile widths without changing production package data or booking behavior.

## Image Treatment

The supplied grey pickup photograph is the edit target. Remove the blue `NEW` ribbon, bottom serial text, camera/search badge, and any remaining marketplace overlay. Reconstruct the covered background, pavement, and vehicle edges naturally.

Preserve the truck, camera angle, body color, reflections, lighting, wheels, surrounding workshop, and photographic realism. Do not add copy, logos, watermarks, badges, or invented vehicle details. Prepare a clean wide landscape composition suitable for the existing PPF information-stage crop. The implementation will use a new project asset rather than overwriting or reusing the previous blue-truck file.

The existing PPF film overlay and decorative linework remain separate HTML/CSS layers so later motion work can target them independently. The image is delivered as an optimized JPEG and retains meaningful alternative text and lazy loading.

## Protection Ladder Layout

The old static package-card markup, car-outline placeholder, tag wall, long preparation/benefit lists, and complimentary-treatment disclosure will be removed from the homepage section.

The new section has two visual regions:

1. A strong blue editorial introduction containing the section title and one short explanation.
2. A white package ladder containing Basic, Premium, and Platinum in ascending protection order.

Each ladder row displays only:

- sequence number;
- package name;
- one-sentence production description;
- concise coverage label;
- film thickness or recommendation label where it materially differentiates the tier;
- warranty summary;
- a clear booking link using the existing package-specific booking state.

No package facts are invented and the underlying `PPF_PACKAGES` model remains authoritative. Information omitted from the homepage remains available to the booking experience and other production surfaces.

## Responsive Behavior

- Desktop: a two-column editorial composition with the blue introduction beside three roomy ladder rows.
- Tablet: the introduction stacks above the ladder; rows keep package information and CTA aligned without horizontal scrolling.
- Mobile: each row becomes a compact vertical block with the package name first, metadata grouped below it, and a full-width 44px-or-taller booking action.
- Long labels wrap naturally; no fixed-width title treatment or `white-space: nowrap` is used.
- The section must not introduce page-level horizontal overflow at any viewport width.

## Accessibility and Interaction

Use semantic section, heading, list/article, and link structure. Booking links remain keyboard accessible with visible focus treatment. The sequence numbers and recommendation labels supplement rather than replace package names. Motion is not required for this change; the section remains fully visible under reduced-motion preferences and retains stable `data-motion` hooks for future GSAP work.

## Production Boundaries

This change is frontend-only. It does not modify Supabase, APIs, schemas, permissions, authentication, booking logic, queue behavior, PWA behavior, production routes, or internal tools. Package-specific navigation continues to `/book` with the existing booking-state payload.

## Verification

- Focused tests confirm the edited image asset is selected and all three production packages retain their booking state.
- Component tests/source assertions confirm legacy detail walls are removed and all ladder rows expose booking actions.
- Changed-file lint and the production build pass.
- Responsive CSS is checked for desktop, tablet, and mobile rules and overflow-safe sizing.
- The existing automated browser security limitation will be reported if rendered viewport inspection remains unavailable.
