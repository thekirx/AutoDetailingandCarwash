# PPF Scroll Copy Design

## Goal

Turn the PPF information section into a five-beat scroll story in which each text chapter appears with the matching moment in the Ranger installation sequence. The opening gives customers a controlled reading moment before the frame sequence begins; subsequent scrolling advances both the video frames and one active message at a time.

## Experience

The section remains pinned while the visitor scrolls. During the first 15% of the pinned distance, the first Ranger frame stays frozen and the introduction remains visible. From 15% onward, scroll progress advances the 110-frame sequence. Each later chapter replaces the previous chapter at a defined point in the installation.

This is scroll-controlled rather than time-controlled. The interface must not lock scrolling or start a two-second timer. Visitors decide how long to read by controlling their own scroll position. Scrolling backward reverses both the frames and the chapter transitions.

Only one chapter is presented as active content at a time. Warranty messaging is removed from the cinematic sequence and remains part of the package information.

## Chapter Timeline and Approved Copy

### 1. Introduction — 0–15%

The canvas displays frame 1 without advancing.

- Eyebrow: `SUPERIOR PROTECTION, EDGE TO EDGE`
- Heading: `PROTECTION ENGINEERED FOR EVERY DRIVE`
- Body: `Clear protection against stone chips, light scratches, road debris, and everyday wear.`

At the end of this chapter, the introduction moves slightly upward and fades before the next chapter becomes fully visible.

### 2. Clarity — 15–35%

This chapter begins as the film becomes visible over the hood.

- Number: `01`
- Label: `CLARITY`
- Heading: `VIRTUALLY INVISIBLE.`
- Body: `Optically clear film preserves the depth, color, and gloss of your factory finish.`

### 3. Stretch — 35–55%

This chapter begins while the camera rotates and the film follows the hood and fender.

- Number: `02`
- Label: `STRETCH`
- Heading: `PRECISION AROUND EVERY CURVE.`
- Body: `Flexible protection conforms to complex body lines for a clean, panel-by-panel fit.`

### 4. Adhesion — 55–75%

This chapter begins as the film settles across the fender and doors.

- Number: `03`
- Label: `ADHESION`
- Heading: `SECURE FROM EDGE TO EDGE.`
- Body: `The film settles around panels, edges, and contours for dependable everyday coverage.`

### 5. Finished Protection — 75–100%

This chapter accompanies the complete protected-truck reveal and remains readable at the end of the pin.

- Number: `04`
- Label: `FINISHED PROTECTION`
- Heading: `PROTECTED FOR EVERY DRIVE.`
- Body: `A virtually invisible layer of defense, with the original finish still leading the view.`

## Frame Mapping

The section's master value is normalized scroll progress from 0 to 1.

- From 0 through 0.15, the rendered frame remains frame 1.
- From 0.15 through 1, visual progress maps linearly across frames 1 through 110.
- Chapter selection uses the same normalized scroll progress and the timeline boundaries above.
- The final chapter remains active through progress 1 so the last frame does not end without context.

No timer, automatic video playback, scroll lock, or independent animation clock is introduced.

## Text Presentation

The large introduction retains the current centered cinematic hierarchy, but its responsive maximum size must keep the full heading inside the usable viewport below the navigation.

The four process chapters use one reusable overlay rather than four simultaneous columns. Each overlay contains the chapter number and label, a short display heading, and one sentence of supporting copy. The active overlay must not conceal the film action or critical vehicle geometry.

Transitions use opacity and transform only:

- Enter: fade from transparent while moving upward a short distance.
- Hold: fully opaque and stationary.
- Exit: fade out while moving slightly upward.
- Do not blur text, animate individual letters, or use hard cuts.

Transitions between adjacent chapters may overlap briefly, but the overlap must not leave two complete paragraphs competing on screen.

## Component Boundaries

### Content data

`src/data/publicHomeContent.js` owns the approved PPF introduction and chapter copy, including timeline boundaries. Copy must not be embedded inside animation code.

### Frame renderer

`src/components/public/home/PpfInstallSequence.jsx` remains responsible for loading, resolving, and drawing the correct desktop or mobile frame set. It converts post-introduction scroll progress into the 1–110 frame range and reports normalized progress to the parent.

### Chapter presentation

`src/components/public/home/HomeServiceSections.jsx` selects and renders the active chapter from normalized progress. It provides one semantic live chapter region without remounting the canvas.

### Styling

`src/styles.css` controls introduction sizing, chapter placement, transitions, contrast, responsive positioning, and reduced-motion behavior. Animation state must be expressed through classes or data attributes rather than inline style calculations.

## Responsive Behavior

### Desktop

- Retain the existing 320% pinned scroll distance.
- Keep the introduction centered.
- Place process chapters in a consistent lower-left or left-center overlay position selected during rendered QA, with a readable maximum line length.
- Preserve the vehicle as the visual focus.

### Mobile

- Retain the shorter 180% pinned scroll distance.
- Use the mobile frame sequence.
- Reduce heading size and place process copy in a compact lower overlay that does not cover the truck's grille or principal panel action.
- Keep body copy to the approved single sentence; do not introduce abbreviated alternate copy.

## Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- Do not create a ScrollTrigger or pin the section.
- Render a static representative protected-vehicle frame.
- Display the introduction followed by all four process chapters in normal document flow.
- Do not hide information behind animation-only state.

## Loading and Failure Behavior

- Continue loading critical frames before the rest of the sequence.
- If a requested frame has not loaded, render the nearest available loaded frame.
- Keep the matching first-frame poster visible until the canvas is ready.
- Text must remain readable if frame loading is delayed.
- A failed frame request must not produce a blank canvas or prevent later chapters from rendering.

## Accessibility

- The introduction remains a level-two section heading.
- Each process chapter uses a level-three heading.
- Decorative chapter numbers are hidden from assistive technology when the label already provides the meaning.
- The canvas remains decorative and hidden from assistive technology; the existing sequence description remains available to screen readers.
- Reversing scroll direction must not trigger disruptive announcements for every fractional progress update.

## Acceptance Criteria

1. Entering the pinned section displays the first Ranger frame and the complete introduction.
2. Frames do not advance during the first 15% of scroll progress.
3. Frames begin advancing immediately after the introduction boundary.
4. Clarity, Stretch, Adhesion, and Finished Protection become active at 15%, 35%, 55%, and 75% respectively.
5. Only one complete process chapter is visually dominant at a time.
6. Scrolling backward restores the correct earlier frame and chapter.
7. The final frame retains the Finished Protection message.
8. Desktop and mobile use their existing device-specific frame sets.
9. Reduced-motion users receive the same information without pinning or scrubbing.
10. The page builds without errors and the PPF section shows no blank canvas, framework overlay, or relevant console error.
