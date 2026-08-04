# Favicon and Social Preview Brand Update

## Goal

Replace the improvised browser icon and AI-generated social preview with official Hakum Auto Care artwork from the supplied Google Drive brand folder.

## Source of Truth

Use the official Drive assets already mirrored under `public/branding/`:

- `hakum-mark-blue.png` for the standalone Hakum mark.
- `hakum-lw-ow.png` for the off-white combined logo and wordmark.

Do not retain any part of the existing AI-generated wet-floor image in the new social preview.

## Considered Treatments

1. **Selected: dark brand treatment.** Use the blue standalone mark for icons and the off-white combined logo/wordmark on a solid navy social card. This has strong contrast, remains legible at small sizes, and matches the site's dark visual identity.
2. Light treatment. Use the blue mark and blue combined lockup on white. This is clean but less aligned with the current site and less distinctive in Messenger.
3. Transparent asset only. Point social metadata directly at a transparent Drive-derived logo file. This risks inconsistent rendering because social platforms may choose their own background and cropping.

## Asset Outputs

- Generate square favicon PNG sizes from the official blue mark, including a standards-friendly high-resolution source.
- Generate the Apple touch icon and PWA icons from the same mark with enough safe padding to avoid clipping on rounded or maskable surfaces.
- Generate a 1200 × 630 PNG social preview with a solid navy background and the off-white combined logo/wordmark centered within generous safe margins.
- Remove the improvised SVG favicon from active HTML metadata so browsers do not prefer it over the official PNG icon.

## Metadata

- Keep the existing site title and descriptions.
- Point Open Graph and Twitter image metadata to the new social preview.
- Add explicit Open Graph image dimensions, type, and alt text.
- Use an absolute production URL for the social image so Facebook Messenger's crawler can resolve it reliably.
- Keep favicon, Apple touch icon, and web app manifest references consistent with the generated files.

## Verification

- Automated metadata checks must fail before the change and pass after it.
- Confirm generated image dimensions and formats.
- Confirm the production build succeeds.
- Inspect the favicon and social preview visually for padding, contrast, and cropping.
- Confirm the final Git diff contains only the intended metadata, tests, and brand asset outputs.

## Cache Note

Facebook Messenger may continue showing a cached preview for a previously shared URL. After deployment, use Facebook's Sharing Debugger to scrape the page again; new shares should then use the updated Open Graph image.
