# Service Detail Pages Design

## Goal

Move protection packages and proof into their matching service pages, give PPF, Ceramic Coating, and Tint their own focused FAQ content, and remove the standalone Packages destination.

## Approved decisions

- The PPF page is `/services/ppf`.
- Only the PPF service-page hero receives scroll-driven motion.
- Unlimited Recoating is highlighted on both Premium and Platinum Ceramic packages.
- FAQs exist only on the three current editorial service pages: PPF, Ceramic Coating, and Tint. Every question must concern that page's service.
- Carwash routes to `/queue` because it is not bookable.
- Interior Detailing and Glass Detailing route to `/book`.
- PPF and Ceramic proof videos come from the corresponding folders in the owner-supplied Google Drive folder.

## Information architecture

The primary navigation no longer includes Packages. The old `/packages` URL remains safe as a redirect to `/services`.

The service catalog resolves a destination from the canonical marketing key:

- Paint Protection Film -> `/services/ppf`
- Ceramic Coating -> `/services/ceramic`
- Nano Ceramic Tint -> `/services/tint`
- Carwash -> `/queue`
- All remaining bookable services, including Interior Detailing and Glass Detailing -> `/book` with booking state preserved

Each editorial service page uses the same overall rhythm but renders only the modules relevant to that service:

1. service hero
2. service explanation / benefits
3. brand or product information where applicable
4. packages where applicable
5. genuine Hakum video proof where applicable
6. service-specific FAQ
7. bottom Book Now call to action

## PPF page

The PPF hero uses a restrained scroll treatment: the image gently scales and translates while the heading moves and fades into the content. Motion is driven by one passive scroll listener using `requestAnimationFrame`, is scoped to `/services/ppf`, and is disabled when `prefers-reduced-motion: reduce` is active.

The “Why PPF” content adds a ClearPro block linked to the official manufacturer. Product statements are limited to claims supported by ClearPro's official PPF page and current UltraClear technical sheet: optical clarity, self-healing behavior, hydrophobic surface, non-yellowing optical TPU, and the product's nominal 7.5 mil construction. Hakum package warranties remain the values already supplied in `ppfPackages.js`; ClearPro warranty wording is not presented as Hakum coverage.

The existing PPF package ladder moves from the removed Packages page into `/services/ppf`. A curated PPF clip from the supplied PPF Drive folder appears as proof below the package presentation. The page ends with PPF-only FAQs and a Book Now action prefilled for Paint Protection Film.

## Ceramic Coating page

The existing Premium and Platinum package cards move into `/services/ceramic`. Both cards display a prominent Unlimited Recoating benefit. A curated Ceramic Coating clip from the supplied Drive folder appears below the packages. The page ends with Ceramic-only FAQs and a Book Now action prefilled for Ceramic Coating.

Unlimited Recoating is treated as an owner-supplied package benefit. The interface will not invent unprovided limits, schedules, transfer rules, or warranty conditions.

## Tint page

The Tint page keeps its existing service explanation, adds tint-only FAQs, and ends with a Book Now action prefilled for Nano Ceramic Tint. It receives neither PPF nor Ceramic packages or proof media.

## Video treatment

Drive files are source assets, not embedded players. Selected videos are downloaded, inspected, transcoded to web-friendly MP4, and stored as local site assets. The proof player uses native controls, a generated poster, `preload="metadata"`, and accessible labeling. It does not autoplay with sound.

Initial selections:

- PPF: `ppf 01.mp4`
- Ceramic: `CR-V CERAMIC 30 SEC.mp4`

Selections may be changed after visual inspection if either clip is not clearly representative of the named service.

## Content and interaction safeguards

- FAQ answers avoid unsupported pricing, exact turnaround times, warranty promises, and legal tint limits that can vary by vehicle or regulation.
- Booking links preserve service prefill state.
- Every accordion control exposes its expanded state and keyboard interaction through native buttons.
- Reduced-motion users see the stable final hero composition.
- Mobile layouts must not introduce horizontal overflow.

## Verification

- Unit tests cover route resolution, service-specific FAQ separation, package placement metadata, and scroll-progress clamping.
- Existing targeted public-site tests remain green.
- Production build succeeds.
- Rendered checks cover desktop and mobile versions of `/services/ppf`, `/services/ceramic`, `/services/tint`, `/services`, and the `/packages` redirect.
- Interaction checks cover FAQ toggles, service-card destinations, video presence, and PPF hero movement.

