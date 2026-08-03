# Public Brand Typography and Logo Design

## Objective

Update the public Hakum Auto Care website to use the approved brand typography and logo assets while preserving the current page structure, content, routes, interactions, and internal product interfaces.

The public website is being recoded from the supplied Hakum reference artwork and `hakumautocare.com`. The supplied revision image defines the core type roles: Benzin for display text and Gilmer for supporting text. Live-reference inspection should be attempted again during visual verification because the site security check prevented access during design discovery.

## Scope

The change applies only to pages rendered inside `PublicLayout` and their shared public components. It includes the public header, footer, landing page, services, packages, branches, events, queue entry points, contact, booking, complaint, legal, and other public marketing or utility routes that inherit the public-site wrapper.

The change does not alter admin, staff operations, authentication, customer-account, CRM, finance, planning, POS, or other internal product surfaces. Existing functionality, content, routing, colors, layout, animations, and responsive behavior remain unchanged except where logo sizing or text metrics require small public-only spacing adjustments.

## Assets

- Use the Google Drive asset named `Hakum LW (OW).png` as the public header and footer brand mark.
- Store a deployment-safe copy in the repository's public assets using a stable, lowercase filename.
- Preserve its transparency and aspect ratio. Do not recolor, crop, stretch, or recreate it with text or CSS.
- Source Benzin from the user-provided `/Users/kiro/Downloads/Benzin-Font/` folder.
- Source Gilmer from the user-provided `/Users/kiro/Downloads/Gilmer_Font/` folder.
- Self-host the font files in the public assets so visitors do not need locally installed fonts or a third-party font service.
- Include only the weights required by the typography mapping. Convert the required Benzin source files to WOFF2 for deployment; use the supplied Gilmer WOFF2 files directly.

## Typography Mapping

### Benzin

- ExtraBold: hero headline and primary public page titles.
- Semibold: major section headings, prominent card titles, the `Experience` heading, and large statistics.
- Medium: compact promotional headings and secondary display text.
- Preserve the reference's uppercase, compressed line-height, italic/slanted treatment, and tight display tracking where those treatments already exist in the public design.

### Gilmer

- Bold: public navigation, buttons, calls to action, and form labels.
- Medium: eyebrows, short labels, and compact metadata.
- Regular: paragraphs, form controls, addresses, legal copy, and footer copy.
- Light: secondary descriptions and helper text.
- Body copy must remain comfortably readable; do not apply the display font to long-form text.

### Isolation

Define explicit font faces and public font tokens, then apply them from the `.public-site` boundary and public component selectors. Do not change the root application font in a way that affects internal interfaces. Shared components used by both public and internal routes must receive public typography only through the public wrapper or an explicit public variant.

## Logo Integration

Replace the generated `H` plus `HAKUM / AUTO CARE` text construction in the public header and footer with the supplied white logo image. Keep the existing home links and accessible names. The logo must remain legible against the dark/translucent header and dark footer, scale down cleanly on mobile, and avoid shifting navigation or action controls outside their current responsive bounds.

Authentication shells and internal layouts retain their current marks because they are outside the approved public-only scope.

## Implementation Boundaries

- Favor the existing `design-tokens.css`, `styles.css`, and `PublicLayout.jsx` structure.
- Add the smallest necessary public-only asset and style changes.
- Do not redesign sections, rewrite copy, replace imagery, or refactor unrelated code.
- Do not modify the synced project `sources/` directory.

## Error and Fallback Behavior

- Every font face must include an appropriate generic fallback.
- Use `font-display: swap` so text remains visible during font loading.
- Reserve logo dimensions through CSS or image attributes to prevent layout shift.
- Keep the existing accessible link label and use an empty image `alt` value so the logo is not announced twice.
- A missing font asset must degrade to the declared fallback without hiding content or breaking layout.

## Verification

- Add a focused regression test that verifies the public font assets and font-family mapping are declared and that the supplied logo is used in both the public header and footer. Confirm the test fails before implementation and passes afterward.
- Run the full automated test suite, lint command, and production build.
- Inspect the public landing page at desktop and mobile widths, checking hero wrapping, navigation fit, logo visibility, section headings, body readability, buttons, and footer layout.
- Inspect at least one secondary public page to confirm the mapping is consistent beyond the landing page.
- Confirm an internal route still uses its existing typography and logo treatment.
- Retry the live `hakumautocare.com` reference during final visual verification. If access remains blocked, record that limitation and verify against the supplied revision image instead.

## Acceptance Criteria

1. Public display typography uses self-hosted Benzin at the approved hierarchy levels.
2. Public supporting typography uses self-hosted Gilmer at the approved hierarchy levels.
3. The public header and footer use `Hakum LW (OW).png` rather than the generated text mark.
4. Public pages remain responsive and readable on desktop and mobile.
5. Internal, customer-account, operations, admin, and authentication interfaces are not restyled.
6. Existing public functionality and routes continue to work.
7. Automated tests, linting, and the production build pass.
