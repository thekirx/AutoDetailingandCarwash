# Hakum Home Hero — Precision to Protection

## Scope

Replace only the public `/home` hero in `HomeHeroSection.jsx` with a cinematic, GSAP-driven desktop experience. Do not modify any later home-page section, staff or admin route, Supabase configuration, `PPFVisualizer.jsx`, `BeforeAfterSlider.jsx`, `WordReveal.jsx`, or `ProcessTimeline.jsx`.

Mobile-specific generated media is explicitly deferred. The desktop implementation must remain structurally responsive and accessible, but no additional mobile generation is part of this pass.

## Live-site findings

- Hakum Auto Care currently serves Bacoor and Batangas, with a Dasmariñas branch shown as coming soon.
- The present hero says “Give your car / The pampering it deserves” and describes expert detailing and precision car care.
- Existing public services include detailing, ceramic coating, paint protection film, and nano ceramic tint.
- Existing conversion routes are `/book` and `/services`; the new hero will use those routes without inventing navigation.
- The visual system uses deep navy (`#020a31` and `#052699`), off-white text, blue accents, and high-contrast automotive imagery.
- Display typography uses Benzin in bold, italic, uppercase treatments; body and control typography use Gilmer.
- The current hero includes an experience/milestone block. That block belongs to the current hero and will be removed from the new minimal first viewport rather than moved into another section.

## Approved direction

**Precision to Protection** is a continuous ten-second automotive sequence built as two five-second clips. It begins with a restrained front-quarter glide across a freshly detailed dark vehicle, then continues into a closer glide along protected, mirror-finished bodywork. The sequence expresses Hakum’s real detailing, ceramic-coating, and PPF focus without showing package names or adding claims.

The look is premium, dark, controlled, and photographic. Lighting is neutral white with subtle Hakum-blue ambience. It must avoid neon, racing cues, aggressive speed, excessive lens flare, visible brand marks from other manufacturers, text, UI, watermarks, and fantastical materials.

## Generated media

### Shared settings

- Provider/model: Higgsfield, Kling 3.0 Turbo
- Output: two videos
- Duration: five seconds each
- Resolution: 1080p
- Aspect ratio: 16:9
- Audio: none required; videos render muted in the browser
- Total estimated generation cost: 10 credits
- Camera speed and lighting direction must remain compatible across the cut
- Keep the left 42% of the frame comparatively dark and visually quiet for readable hero copy
- The second clip uses the first clip’s final frame as its start image to preserve vehicle, camera, lighting, and surface continuity

### Clip one — establishing glide

Prompt intent: a premium commercial shot of a dark graphite performance-luxury vehicle inside a clean, dark automotive detailing studio. The camera performs an extremely slow, stabilized lateral dolly along the front quarter and hood. Controlled neutral strip lighting travels softly across freshly detailed paint, revealing deep gloss without flares. The vehicle remains still. Composition keeps the left side dark and uncluttered for website copy. No people, text, logos, neon, racing, smoke, rain, rapid motion, camera shake, or dramatic zoom.

The final frame must settle on a clean section of the hood/front-side bodywork suitable for continuing into a closer surface shot.

### Clip two — protected finish

Use clip one’s extracted final frame as the start image. Prompt intent: continue the same stabilized camera motion, vehicle, studio, crop direction, exposure, and strip-light reflections without a visible jump. The camera gently closes in along the same body panel, revealing the smooth, mirror-like protected finish associated with professional detailing, ceramic coating, and paint protection. A single restrained highlight travels across the curvature. Keep the left side dark enough for copy. No hands, tools, text, logos, neon, racing, smoke, water splash, abrupt reframing, or speed ramp.

### Delivery preparation

The generated downloads will be placed under a hero-specific public media directory and referenced through clearly named constants in the component. Two stacked, muted video elements form a controlled playlist: the inactive element is prepared behind the active one, then opacity is exchanged at the transition. Placeholder paths remain clearly marked in the delivered component so the assets can be replaced without changing animation logic.

## Hero content

- One semantic `<section>` with an accessible label
- One `<h1>` only: **Pamper it. Protect it.**
- Subhead: **Precision detailing, ceramic coating, and paint protection for drivers who care how their finish lasts.**
- Primary CTA: **Book a service** → `/book`
- Secondary CTA: **Explore services** → `/services`
- CTAs retain explicit accessible labels
- No eyebrow, location label, metrics, package names, or additional hero claims

## Visual architecture

The hero uses three isolated layers:

1. **Media:** absolute, full-bleed video elements using `object-fit: cover`, behind all other content.
2. **Animation treatment:** a dark contrast gradient, navy tint layer, one gloss accent, and edge protection for copy. All animated treatment uses transforms and opacity.
3. **Content:** semantic React content above the media, left aligned within the existing public-site container rhythm.

The first viewport is dark and spacious. The content occupies roughly the left two-fifths at desktop widths, while the most descriptive vehicle reflections remain toward center-right. The overlay provides AA contrast even if a generated frame is brighter than expected.

## Motion design

### Entrance timeline

- Media fades from black over 0.8 seconds with `power2.out`.
- The heading is manually split into words to avoid relying on a paid SplitText license. Each word moves from `y: 40` and opacity zero with a 60 ms stagger and `power3.out` easing.
- The subhead begins 0.2 seconds after the last heading word completes.
- CTAs enter from a subtle vertical offset and scale `0.96`, staggered by 0.1 seconds.
- One low-opacity gloss streak crosses the frame once, then its `will-change` hint is removed.

### Ambient motion

- Pointer parallax moves the media no more than 15 px using GSAP quick setters or quick-to tweens.
- The overlay tint shifts slowly over a 10-second loop.
- There is no CTA pulse, bounce, looping light streak, or decorative motion competing with the copy.

### Scroll motion

- `ScrollTrigger` scrubs the media to `yPercent: 15` as the section exits.
- Content opacity reduces slightly while the user scrolls through the hero.
- The hero is not pinned.

### Reduced motion

When `prefers-reduced-motion: reduce` matches, videos may display their opening poster/frame without ambient or scroll transforms. Essential content uses short opacity-only reveals. Pointer parallax, tint looping, gloss motion, and scroll parallax are disabled.

## React and GSAP implementation

`HomeHeroSection.jsx` owns refs for the section, media wrapper, content, overlay, gloss accent, and CTA group. GSAP and ScrollTrigger are registered locally using the project’s existing dependency. The effect uses `gsap.context()` scoped to the hero and calls `context.revert()` during cleanup. Pointer listeners and media transition listeners are also removed during cleanup.

The repository already uses GSAP for the PPF install sequence. The new hero creates only hero-scoped timelines and triggers, so it does not alter that sequence. Motion-based components elsewhere remain untouched; GSAP operates directly on refs inside this component, avoiding shared animation state or global selectors.

## Media sequencing and fallback behavior

Clip one starts when it can play. Near its end, clip two is prepared and then shown from time zero to minimize the cut. When clip two completes, the sequence returns to clip one with a short dark-overlay crossfade rather than a hard flash. The hero must remain legible if autoplay is blocked: the first video’s poster or the existing `hakum-hero.webp` image acts as the fallback background.

If either video fails, the other video or fallback image stays visible. Media errors must not hide content or collapse the section.

## Styling and breakpoints

Hero styles remain in the project’s existing stylesheet rather than introducing a second styling system. They preserve the site’s Benzin/Gilmer typography and navy/off-white palette.

- Base/640 px: structurally responsive fallback; mobile-specific generated media is deferred
- 768 px: desktop media treatment begins
- 1024 px: full left-aligned cinematic composition
- 1280 px: maximum content width and intended negative-space balance

Only transform and opacity properties animate. Static layout can use normal CSS sizing and positioning. `will-change` is applied only while a relevant entrance or pointer animation is active.

## Accessibility and performance

- Semantic section and single H1
- CTA `aria-label` values that describe their destinations
- Videos are muted, autoplaying, inline, decorative, and excluded from the accessibility tree
- A persistent dark overlay guarantees text contrast against all frames
- Preload metadata for video; avoid preloading unrelated mobile assets
- No layout-affecting animation properties
- Cleanup destroys all hero ScrollTriggers, timelines, listeners, and transient style hints

## Verification

- Build and targeted tests must pass without changing out-of-scope sections.
- Verify desktop at 1280×720 and 1440×900, plus a structural check at the 768 px boundary.
- Confirm the hero scrolls away freely and does not pin.
- Confirm the second clip continues from the first clip’s last frame without an obvious vehicle or lighting change.
- Confirm both routes navigate correctly.
- Confirm reduced-motion behavior contains no ambient loop or scroll transform.
- Confirm no console errors, autoplay-related content failures, or duplicate H1 elements.
- Compare the rendered hero against the approved design for copy, composition, palette, typography, media crop, and motion restraint.
