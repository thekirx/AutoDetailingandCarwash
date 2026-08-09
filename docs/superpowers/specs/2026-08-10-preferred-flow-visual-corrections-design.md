# Preferred Flow Visual Corrections Design

## Goal

Refine the approved `PreferedWebFlow` homepage without changing its overall structure, current Hakum visual identity, or CMS foundation. The revision replaces the simple PPF information split panel with a reference-led feature section, removes the Classic ceramic tier, fixes two desktop headline overflows, and adds Dasmariñas as a coming-soon branch.

## Scope

The work is limited to the public homepage and its existing public-content tests. It does not change the PPF package selector, Team Portal, Supabase schema, partnership submission adapter, header, footer, or homepage section order.

## PPF Information Section

The section will use the supplied reference for composition rather than copying its branding or claims. It will have:

- a black, full-width stage;
- the eyebrow `Superior protection, edge to edge`;
- the safe headline `Protection engineered for every drive.`;
- four feature callouts: Clarity, Stretch, Adhesion, and Warranty;
- Hakum-specific, neutral supporting copy that avoids unverified market-leader or warranty-duration claims;
- the existing Hakum Paint Protection Film image as the visual focal point;
- CSS linework and a translucent blue film layer to evoke the reference's technical diagram;
- existing `data-motion-section`, `data-motion`, and `data-motion-item` hooks for later GSAP work.

On desktop, the headline and four callouts sit above the large image. On mobile, the heading, callouts, and image stack in reading order; decorative connector lines are simplified or removed so text remains readable.

## Ceramic Coating Packages

Classic is removed from the exported package data so it cannot render on the homepage. Premium and Platinum remain in their current order and retain their existing Hakum images and content. The package grid becomes a two-column layout on desktop and a single-column stack on mobile.

No database or portal behavior is involved because ceramic package content is currently static homepage data.

## Overflow Corrections

### Nano Ceramic Tint

The split-feature text column will explicitly constrain its minimum width, clip decorative overflow, and use a container-aware or narrower responsive display size. `Cooler cabin. Clearer drive.` must remain completely inside the left panel at common desktop widths and continue to stack cleanly on mobile.

### Partnership

The partnership grid will reserve sufficient width for both columns. Its heading will use a smaller maximum size and controlled line breaks so it cannot extend over the form. The form fields, validation, unavailable state, and data contract remain unchanged.

## Dasmariñas Coming Soon

The branch grid will render active branch data first. It will then render one static, non-clickable Dasmariñas card with:

- the next visible sequence number;
- location label `Dasmariñas, Cavite`;
- a `Coming Soon` status instead of an arrow;
- styling consistent with branch cards but visibly inactive;
- no queue or branch destination.

When live branch data is unavailable, the existing Bacoor and Batangas fallbacks remain and Dasmariñas is appended as card 03. The section description will say `2 active branches, with Dasmariñas coming soon` when fallback data is shown. Live branch count remains derived from active data and does not count the coming-soon location.

## Responsive and Accessibility Behavior

- No horizontal page overflow at desktop or mobile sizes.
- Decorative PPF linework is hidden from assistive technology.
- The coming-soon card is an article, not a link, and its status is visible text.
- Existing headings preserve logical document order.
- Existing focus behavior, navigation, PPF package interaction, form labels, and form feedback remain unchanged.
- Reduced-motion users are not given new animation behavior; this remains preparation-only.

## Verification

Automated checks will cover:

- Classic absent while Premium and Platinum remain;
- PPF feature labels and safe headline present;
- Dasmariñas rendered as coming soon and not linked;
- existing preferred homepage section order unchanged.

Rendered verification will cover desktop and mobile views of PPF Info, Ceramic, Nano Tint, Partnership, and Branches, plus horizontal overflow, console health, PPF package interaction, and partnership validation.
