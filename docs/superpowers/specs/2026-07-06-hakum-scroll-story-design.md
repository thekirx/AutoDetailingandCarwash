# Hakum Auto Care Pinned Car Scroll Story

Date: 2026-07-06
Status: Approved design

## Objective

Add a GSAP ScrollTrigger-driven car-care story to the public homepage without redesigning Hakum Auto Care or changing its information architecture. The existing hero remains the first impression. The new story begins immediately after it and transitions visitors into the current About, Services, Packages, PPF, Queue, Branch, and footer content.

## Approved Placement

Use the additive “Story after current hero” approach:

1. Existing public header and hero remain unchanged.
2. The new pinned car story is inserted immediately after the hero.
3. Existing homepage sections remain in their current order after the story.
4. Existing booking, services, packages, branches, and queue routes remain unchanged.

The story does not replace the hero, service grid, PPF visualizer, ceramic package cards, or queue teaser.

## Visual Direction

The story extends the current Hakum system rather than introducing a second brand language:

- Reuse the existing condensed italic display typography, body typography, royal-blue identity, spacing rhythm, sharp-edged controls, and editorial labels.
- Use black, charcoal, silver, white, and Hakum blue throughout the story.
- Reserve bright cyan/lime accents for PPF coverage activation only.
- Use a dark luxury garage environment with restrained reflections and mist.
- Avoid colorful, playful, card-heavy, rounded, or generic technology-product styling.
- Preserve the existing hero artwork and hero copy exactly.

## Artwork Strategy

Create a temporary matched set from one generated base vehicle: a dark premium SUV shown in a centered three-quarter front view. Derive all treatment states from the same base composition so the vehicle identity, camera, body shape, wheels, and proportions remain stable.

Required states:

1. Dirty arrival
2. Clean/washed
3. Detailed/paint-corrected
4. PPF-protected
5. Ceramic-coated/glossy

Store the assets under `src/assets/scroll-story/` and expose them through a single `scrollStoryAssets` manifest. Components and timelines may only consume the manifest, never import state artwork directly. A future vehicle replacement therefore changes the manifest and artwork files without rewriting animation logic.

Water jets, foam, mist, PPF coverage outlines, gloss sweeps, and droplets should be lightweight code-native CSS/SVG layers where practical. The raster states provide the vehicle and primary lighting, while overlays provide the scrubbed transitions.

## Component Architecture

### `PinnedCarStory`

Owns the story markup, state copy, progress navigation, package selector, and reduced-motion rendering. It is inserted once in `PublicLandingPage` immediately after the existing hero.

### `PinnedCarVisual`

Renders the centered vehicle layers from the asset manifest plus reusable CSS/SVG effect layers. It has no routing or booking responsibilities.

### `usePinnedCarStory`

Registers GSAP and ScrollTrigger, creates the pin and scrubbed master timeline, scopes selectors to the component, refreshes after image readiness, and destroys every animation and trigger on cleanup.

### `scrollStoryAssets`

A small manifest containing state image URLs and optional overlay URLs. It is the only artwork boundary used by the story.

### Story data

Section labels, copy, scroll weights, and package preview mappings are declared in data rather than repeated across JSX and timeline code.

## Scroll Sequence

The car visual remains centered while copy, background lighting, raster state opacity, and effect overlays change.

### 1. Dirty Car Arrival

- Dark garage background.
- Dirty/desaturated state visible.
- Headlights and ambient garage lighting settle in as the story enters.
- Mist drifts subtly.
- Copy: “From daily dirt to showroom finish.”
- Existing hero CTAs are not duplicated inside this section because they remain directly above it.

### 2. Carwash

- Shortest scroll segment.
- Water sweep travels left to right.
- Grime state crossfades to the washed state behind a masked reveal.
- Foam appears briefly and rinses away.
- Copy: “Fast, clean, and reliable exterior care for everyday vehicles.”

### 3. Detailing

- Vehicle framing tightens slightly using transform-only scale.
- Paint-corrected state replaces the washed state.
- Swirl marks fade out.
- Three small close-up insets show paint, wheel, and interior details without obscuring the main car.
- Copy: “Deep cleaning, paint correction, and interior restoration for a fresher, newer-looking car.”

### 4. Paint Protection Film

- Longest scroll segment.
- PPF coverage progresses hood → bumper → mirrors → doors.
- Each panel receives a brief cyan/lime outline activation.
- The protected raster state crossfades in beneath the coverage overlays.
- Basic, Premium, and Platinum comparisons appear at the segment end using existing PPF package data where applicable.
- Copy: “Invisible paint protection against scratches, chips, road debris, and daily wear.”

### 5. Ceramic Coating

- Background becomes slightly darker and more reflective.
- Glossy raster state crossfades in.
- A controlled light sweep increases perceived sheen.
- Water droplets bead and move off the hood.
- A small gloss meter fills as a restrained UI accent.
- Copy: “Long-lasting gloss, easier cleaning, and stronger paint defense.”

### 6. Package Selector

- Wash, Detail, Ceramic, and PPF controls map to the same visual states and overlays already used by the story.
- Hover, focus, and tap update the preview.
- Keyboard controls remain operable and expose the current selection.
- Package cards link to existing service/package/booking routes rather than introducing a new transaction flow.

### 7. Existing Action Sections

The pin ends before the existing About section. The homepage then resumes its current sections and eventually reaches the existing queue, branches, booking links, and footer. These remain calm, functional, and free of heavy scroll effects.

## Timeline and Data Flow

`PinnedCarStory` supplies scoped DOM refs and story data to `usePinnedCarStory`. The hook creates one master GSAP timeline and one pinned ScrollTrigger. Segment weights determine relative scroll distance; PPF receives the largest weight and Carwash the smallest.

The timeline animates transforms, opacity, masks/clip paths, and CSS custom properties. It does not animate layout properties such as width, height, top, or margin. Package-selector interaction updates local React state independently of scroll and reuses the same manifest entries.

## Responsive Behavior

- Desktop and tablet use the pinned story with adjusted copy placement and vehicle scale.
- Mobile keeps the car centered, stacks copy below or beside it according to available height, and reduces inset detail panels.
- On short viewports, the story avoids clipping by using viewport-aware minimum sizes and shorter copy blocks.
- The pin must not create horizontal overflow or interfere with the fixed public header.

## Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- Do not create the scrubbed GSAP timeline or pinned ScrollTrigger.
- Render the five states as a simple static/crossfade editorial sequence.
- Disable drifting mist, light flicker, water movement, gloss sweep, and droplet motion.
- Preserve all copy, controls, links, and package selection functionality.

## Performance

- Lazy-load noninitial state images and decode images before refreshing ScrollTrigger.
- Use opacity and transforms for the main transitions.
- Use `will-change` only on actively animated layers.
- Keep overlays small and reusable.
- Avoid Three.js and the existing GLB model for this story.
- Scope and clean up ScrollTrigger instances to prevent duplicated triggers during React development remounts.

## Error Handling

- If a derived state image fails, keep the last successfully loaded vehicle state visible.
- If GSAP cannot initialize, render the reduced-motion/static version instead of hiding content.
- Missing optional effect overlays do not block copy, package controls, or navigation.
- Asset-manifest entries include meaningful alt/role handling; decorative duplicates remain hidden from assistive technology.

## Accessibility

- The story has one descriptive semantic image equivalent; crossfaded duplicate layers are decorative.
- Copy remains real HTML text.
- Package controls support keyboard focus, selected state, and tap interaction.
- Contrast follows the current dark Hakum sections.
- The scroll experience never traps keyboard focus or wheel/touch scrolling.

## Testing and Verification

Verify:

1. Existing routes, header navigation, hero links, booking form, and live queue still work.
2. The story pins and unpins at the correct points and each state follows scroll progress.
3. StrictMode/remounting does not duplicate ScrollTriggers.
4. Reduced-motion mode contains no pinning or continuous effect motion.
5. Package hover, focus, and tap update the preview and links use current routes.
6. Desktop, tablet, mobile, and short-height viewports have no clipping or horizontal overflow.
7. Generated imagery keeps the same car identity and alignment across all states.
8. The implementation visually matches the current site’s typography, palette, container widths, and interaction styling.

## Out of Scope

- Redesigning the existing hero or public site.
- Reordering or removing current homepage sections.
- Replacing booking, queue, package, branch, or authentication flows.
- WebGL/Three.js car animation.
- Autoplaying a cinematic sequence independently of scroll.
- Making the temporary generated vehicle artwork permanent or difficult to replace.

## Acceptance Criteria

The feature is complete when the current hero flows into a polished five-state pinned-car story, all scroll states and the package selector work, reduced motion has a complete static fallback, current site behavior remains intact, and the entire vehicle art set can be replaced through the asset manifest without changing the timeline or component structure.
