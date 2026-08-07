# Mobile 3D Viewer and iPhone Safe-Area Design

## Goal

Make the public Hakum website use the real interactive PPF vehicle model on mobile and extend the Hakum-blue header background through the iPhone status-bar/notch area, matching the edge-to-edge behavior shown on Kado Kohi.

## Current behavior and root causes

- At viewport widths of 500px or less, `src/styles.css` sets `.ppf-canvas-stage` to `display:none` and displays `.ppf-mobile-diagram`. The flat diagram is therefore intentional responsive behavior rather than a WebGL failure.
- `index.html` uses a standard viewport declaration without `viewport-fit=cover`. The fixed public header also has no top safe-area padding, so iOS keeps the page below the status area instead of painting Hakum blue behind it.

## Approved approach

Use the existing Three.js/React Three Fiber viewer at every viewport width. Remove the flat mobile diagram markup and its dedicated styles. Keep one shared model, camera, coverage state, package switching behavior, and interaction model across desktop and mobile.

Enable iPhone edge-to-edge layout with `viewport-fit=cover`. Paint the fixed public header through the top safe area while padding the header controls by `env(safe-area-inset-top)`, so the background reaches behind the Dynamic Island/notch but the logo and menu remain unobstructed. Update dependent mobile navigation sizing so its available height includes the safe-area-adjusted header.

## Component changes

### PPF visualizer

- Delete `.ppf-mobile-diagram` from `PPFVisualizer.jsx`.
- Keep `.ppf-canvas-stage` visible below 500px.
- Size and position the mobile canvas so the Mazda RX-7 remains centered with enough space for the viewer label, coverage legend, attribution, and touch interaction.
- Retain auto-rotation, drag rotation, package highlighting, panel selection, and the existing WebGL disposal behavior.
- Use touch-specific CSS only where needed to make horizontal rotation reliable without creating a page-wide scroll trap.

### Public header and safe area

- Change the viewport meta value to include `viewport-fit=cover`.
- Keep the Hakum-blue header background fixed at the physical top edge.
- Add safe-area top padding to the public header while preserving the current 88px desktop and 76px small-mobile control-row heights.
- Adjust the mobile navigation maximum height using the safe-area inset so an open menu remains fully scrollable.
- Preserve the existing blue theme color and translucent header treatment.

## Accessibility and failure behavior

- The 3D viewer remains labelled by the existing “Interactive coverage view” copy and package state.
- Package tabs remain keyboard-accessible buttons with tab semantics.
- No flat-image or flat-diagram fallback will be shown on mobile.
- Existing model attribution remains visible.
- If WebGL is unavailable, the page must remain usable and the package details and booking action must still render; the implementation will not substitute the removed diagram.

## Verification

Add regression tests that assert:

- The viewport metadata includes `viewport-fit=cover`.
- The mobile stylesheet no longer hides `.ppf-canvas-stage`.
- `PPFVisualizer.jsx` no longer renders `ppf-mobile-diagram`.
- The public header uses the top safe-area inset and the mobile menu height accounts for it.

Run the existing automated test suite, lint, and production build. Render and interact with the page at a representative iPhone viewport and a desktop viewport. On mobile, verify that the blue background reaches behind the status area, the logo and menu remain below it, the model visibly auto-rotates, drag changes its angle, package switching changes coverage, and no relevant console errors appear.

## Out of scope

- Rebuilding the viewer with separate mobile and desktop Three.js scenes.
- Changing the vehicle model, PPF package data, desktop visual design, or public navigation content.
- Adding a new flat image, poster, or diagram fallback.
- Deployment or production publishing unless requested separately.
