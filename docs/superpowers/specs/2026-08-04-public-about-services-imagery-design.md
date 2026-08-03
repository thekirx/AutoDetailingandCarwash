# Public About Us and Services Imagery Design

**Date:** 2026-08-04  
**Branch:** `AlignedWithBranding`  
**Scope:** Public homepage About Us and Services sections only

## Objective

Replace the temporary repeated hero imagery with the supplied Hakum photography and align the About Us and Services presentation with the approved reference images. Preserve the approved hero composition and the pending Gilmer Regular/legacy italic typography pass.

## Source Assets

The source folder is the user-provided Google Drive folder:

`https://drive.google.com/drive/folders/1T0pXIzwCzX8XMXWwx8AQjm91Jbi6DI2l`

Files map by name to the homepage as follows:

| Drive file | Homepage use |
| --- | --- |
| `HKM-21.jpg` | About Us feature image |
| `Car Wash.jpg` | Carwash card |
| `Interior Detailing.jpg` | Interior Detailing card |
| `Ceramic tint.jpg` | Ceramic Tint card |
| `Ceramic Coating.jpg` | Ceramic Coating card |
| `Glass Detailing.jpg` | Glass Detailing card |
| `Engine Wash.jpg` | Engine Wash card |
| `PPF.jpg` | Paint Protection Film card |

Mobile Detailing has no supplied photograph. It remains the locked, dark-blue placeholder shown in the approved Services reference.

Downloaded originals will not be committed unchanged. Website copies will be resized and converted to WebP with descriptive kebab-case filenames under `src/assets/services/`, while retaining enough resolution for high-density desktop displays.

## About Us Design

The section retains the deep Hakum-blue background and oversized italic Benzin `About Us` heading. The content becomes a high-contrast two-column editorial panel:

- `HKM-21.jpg` fills the left column with an intentional crop using `object-fit: cover` or an equivalent background treatment.
- The right column is white and contains the existing story copy.
- The opening paragraph is the visual lead: larger than the remaining body copy, italic, and set in Gilmer Regular. `Founded in 2024` receives stronger emphasis without changing the written message.
- Remaining paragraphs use upright Gilmer Regular for readability.
- The branch CTA stays at the bottom of the copy panel.
- The panel edges remain square, matching the reference artwork.

On tablet and mobile, the columns stack with the image first and copy second. The heading scales down without clipping, and the text panel retains comfortable gutters.

## Services Design

The section reproduces the approved 4-by-2 desktop grid:

- Four equal columns and two rows with a narrow blue gutter.
- Each available service card has a photographic top panel and a white copy panel.
- Photos fill a consistent aspect ratio using `object-fit: cover`; per-service positioning may be adjusted to keep the subject visible.
- Card headings use upright Benzin Semibold, matching the supplied card reference.
- Descriptions use Gilmer Regular.
- The existing `Book now` row remains at the bottom of each available service card.
- Decorative service numbers and corner icons are removed from photographic cards.
- Mobile Detailing uses a solid dark-blue visual panel with the cyan lock icon and keeps its explanatory copy below. It does not link to an unavailable booking selection.

The grid changes to two columns for tablets and one column for phones. Card image proportions and reading order remain consistent at every breakpoint.

## Component and Data Changes

The `services` data in `PublicLandingPage.jsx` will gain explicit image paths and availability state instead of background-position-only metadata. Rendering will branch between:

1. an available photographic service card with a booking link, and
2. the locked Mobile Detailing card without an active booking link.

No backend, booking API, authentication, database, or staff application behavior changes are included.

## Accessibility and Failure Behavior

- Every service image receives descriptive alternative text derived from the service name.
- The About Us image retains a descriptive accessible label.
- The Mobile Detailing lock is decorative when the visible copy already communicates availability.
- Local optimized assets eliminate runtime dependence on Google Drive.
- If an asset import or optimization fails, implementation stops rather than silently reusing the hero image.

## Verification

Automated checks will verify:

- every supplied filename maps to the intended section or service;
- all optimized assets exist in the repository;
- seven service cards render photographic assets;
- Mobile Detailing renders the locked state without a booking link;
- About Us uses the dedicated `HKM-21` asset;
- responsive Services grid rules remain four, two, and one columns;
- the production build succeeds.

Manual review at the local preview will compare desktop and mobile layouts with the approved reference images, focusing on crop quality, card proportions, heading scale, and the emphasized About Us lead paragraph.
