# Hakum Pinned Car Scroll Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a replaceable five-state, GSAP ScrollTrigger-driven car-care story immediately after the existing public hero without altering current routes or functional sections.

**Architecture:** A `scrollStoryAssets` manifest isolates all generated artwork from UI and timeline logic. `PinnedCarStory` renders semantic copy, layered vehicle states, effects, and the interactive package preview; `usePinnedCarStory` owns all scoped GSAP/ScrollTrigger setup and cleanup, while reduced-motion users receive a static editorial sequence.

**Tech Stack:** React 19, Vite 6, GSAP 3 + ScrollTrigger, Vitest, Testing Library, CSS/SVG effect layers

---

## File Structure

- Create `src/assets/scroll-story/dirty-arrival.webp`: generated dirty vehicle state.
- Create `src/assets/scroll-story/washed.webp`: generated washed vehicle state.
- Create `src/assets/scroll-story/detailed.webp`: generated corrected/detail state.
- Create `src/assets/scroll-story/ppf-protected.webp`: generated PPF state.
- Create `src/assets/scroll-story/ceramic-gloss.webp`: generated ceramic state.
- Create `src/features/scroll-story/scrollStoryAssets.js`: sole import boundary for state artwork.
- Create `src/features/scroll-story/scrollStoryData.js`: copy, timing weights, and package mappings.
- Create `src/features/scroll-story/usePinnedCarStory.js`: scoped GSAP and ScrollTrigger lifecycle.
- Create `src/features/scroll-story/PinnedCarVisual.jsx`: layered car and code-native effects.
- Create `src/features/scroll-story/PinnedCarStory.jsx`: semantic story layout and package interaction.
- Create `src/features/scroll-story/scrollStory.css`: isolated desktop, mobile, and reduced-motion styling.
- Create `src/features/scroll-story/scrollStoryAssets.test.js`: manifest contract coverage.
- Create `src/features/scroll-story/PinnedCarStory.test.jsx`: static fallback and interaction coverage.
- Modify `src/pages/PublicLandingPage.jsx`: insert the story after the existing hero only.
- Modify `package.json` and `package-lock.json`: add GSAP and test tooling.

### Task 1: Install Animation and Test Tooling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add the test script and dependencies**

Run:

```bash
npm install gsap
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

- [ ] **Step 2: Verify the installed packages resolve**

Run:

```bash
npm exec vitest -- --version
npm ls gsap
```

Expected: Vitest prints a version and `npm ls` lists one installed `gsap` package without errors.

- [ ] **Step 3: Commit tooling**

```bash
git add package.json package-lock.json
git commit -m "build: add scroll animation and test tooling"
```

### Task 2: Generate and Isolate the Replaceable Vehicle Artwork

**Files:**
- Create: `src/assets/scroll-story/dirty-arrival.webp`
- Create: `src/assets/scroll-story/washed.webp`
- Create: `src/assets/scroll-story/detailed.webp`
- Create: `src/assets/scroll-story/ppf-protected.webp`
- Create: `src/assets/scroll-story/ceramic-gloss.webp`
- Create: `src/features/scroll-story/scrollStoryAssets.test.js`
- Create: `src/features/scroll-story/scrollStoryAssets.js`

- [ ] **Step 1: Generate the clean base vehicle**

Use the built-in image generation tool with this production prompt:

```text
Use case: ads-marketing
Asset type: Hakum Auto Care pinned scroll-story vehicle
Primary request: Create a photorealistic dark graphite premium SUV in a fixed three-quarter front view inside a dark luxury detailing bay.
Subject: One unbranded modern SUV, entire vehicle visible, centered, wheels straight, consistent body panels and wheel design.
Composition/framing: 16:9 landscape, camera at headlight height, vehicle occupies the central 68%, generous clear space around all edges, no crop.
Lighting/mood: restrained royal-blue Hakum ambient lighting, charcoal garage, silver highlights, premium and trustworthy.
Constraints: no people, no text, no logo, no watermark, no other vehicles, no extreme reflections, no colored body paint, stable composition suitable for derived edits.
```

Save the selected clean output as `src/assets/scroll-story/washed.webp`.

- [ ] **Step 2: Derive the four remaining states from the clean base**

Edit the clean base four times, preserving camera, vehicle identity, position, body shape, wheels, garage, and crop exactly:

```text
Dirty arrival: add realistic road dust, muted paint, light grime around lower doors, wheel arches, bumper, and hood; headlights dim; keep the vehicle fully visible.
Detailed: remove all dirt and swirl marks; deepen clean paint reflections; restore tires and trim; keep gloss below ceramic-coating intensity.
PPF protected: keep clean corrected paint and add only a subtle clear-film edge/refraction along hood, bumper, mirrors, and doors; do not tint the whole vehicle cyan or lime.
Ceramic gloss: add deep mirror-like paint gloss, crisp studio highlight, and subtle water beads on the hood; keep body color graphite and preserve every vehicle detail.
```

Save as the four named WebP files in the file list.

- [ ] **Step 3: Write the failing manifest contract test**

Create `src/features/scroll-story/scrollStoryAssets.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { scrollStoryAssets } from './scrollStoryAssets'

describe('scrollStoryAssets', () => {
  it('exposes every replaceable vehicle state through one manifest', () => {
    expect(Object.keys(scrollStoryAssets.vehicle)).toEqual([
      'dirty', 'washed', 'detailed', 'ppf', 'ceramic',
    ])
    Object.values(scrollStoryAssets.vehicle).forEach((url) => {
      expect(url).toMatch(/\.(png|webp)$/)
    })
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- src/features/scroll-story/scrollStoryAssets.test.js`

Expected: FAIL because `scrollStoryAssets.js` does not exist.

- [ ] **Step 5: Implement the manifest**

Create `src/features/scroll-story/scrollStoryAssets.js`:

```js
import dirty from '../../assets/scroll-story/dirty-arrival.webp'
import washed from '../../assets/scroll-story/washed.webp'
import detailed from '../../assets/scroll-story/detailed.webp'
import ppf from '../../assets/scroll-story/ppf-protected.webp'
import ceramic from '../../assets/scroll-story/ceramic-gloss.webp'

export const scrollStoryAssets = Object.freeze({
  vehicle: Object.freeze({ dirty, washed, detailed, ppf, ceramic }),
})
```

- [ ] **Step 6: Run the manifest test**

Run: `npm test -- src/features/scroll-story/scrollStoryAssets.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the artwork boundary**

```bash
git add src/assets/scroll-story src/features/scroll-story/scrollStoryAssets.js src/features/scroll-story/scrollStoryAssets.test.js
git commit -m "feat: add replaceable scroll story artwork"
```

### Task 3: Define Story Copy, Timing, and Package Mapping

**Files:**
- Create: `src/features/scroll-story/scrollStoryData.js`
- Modify: `src/features/scroll-story/scrollStoryAssets.test.js`

- [ ] **Step 1: Extend the failing contract test**

Append:

```js
import { packageOptions, storyStages } from './scrollStoryData'

it('keeps carwash shortest and PPF longest', () => {
  const weights = Object.fromEntries(storyStages.map(({ id, weight }) => [id, weight]))
  expect(weights.carwash).toBe(Math.min(...Object.values(weights)))
  expect(weights.ppf).toBe(Math.max(...Object.values(weights)))
})

it('maps every package preview to a manifest state', () => {
  const stateNames = Object.keys(scrollStoryAssets.vehicle)
  packageOptions.forEach(({ state }) => expect(stateNames).toContain(state))
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/features/scroll-story/scrollStoryAssets.test.js`

Expected: FAIL because `scrollStoryData.js` does not exist.

- [ ] **Step 3: Implement story data**

Create `src/features/scroll-story/scrollStoryData.js`:

```js
export const storyStages = [
  { id: 'arrival', number: '01', label: 'Dirty car arrival', state: 'dirty', weight: 1.1, copy: 'From daily dirt to showroom finish.' },
  { id: 'carwash', number: '02', label: 'Carwash', state: 'washed', weight: .75, copy: 'Fast, clean, and reliable exterior care for everyday vehicles.' },
  { id: 'detailing', number: '03', label: 'Detailing', state: 'detailed', weight: 1.25, copy: 'Deep cleaning, paint correction, and interior restoration for a fresher, newer-looking car.' },
  { id: 'ppf', number: '04', label: 'Paint protection film', state: 'ppf', weight: 1.8, copy: 'Invisible paint protection against scratches, chips, road debris, and daily wear.' },
  { id: 'ceramic', number: '05', label: 'Ceramic coating', state: 'ceramic', weight: 1.25, copy: 'Long-lasting gloss, easier cleaning, and stronger paint defense.' },
]

export const packageOptions = [
  { id: 'wash', label: 'Wash', bestFor: 'Everyday maintenance', state: 'washed' },
  { id: 'detail', label: 'Detail', bestFor: 'Deep cleaning / restoration', state: 'detailed' },
  { id: 'ceramic', label: 'Ceramic', bestFor: 'Gloss and easier cleaning', state: 'ceramic' },
  { id: 'ppf', label: 'PPF', bestFor: 'Maximum paint protection', state: 'ppf' },
]
```

- [ ] **Step 4: Run the data tests**

Run: `npm test -- src/features/scroll-story/scrollStoryAssets.test.js`

Expected: PASS.

- [ ] **Step 5: Commit story data**

```bash
git add src/features/scroll-story/scrollStoryData.js src/features/scroll-story/scrollStoryAssets.test.js
git commit -m "feat: define scroll story stages"
```

### Task 4: Build the Static and Interactive Story First

**Files:**
- Create: `src/features/scroll-story/PinnedCarStory.test.jsx`
- Create: `src/features/scroll-story/PinnedCarVisual.jsx`
- Create: `src/features/scroll-story/PinnedCarStory.jsx`

- [ ] **Step 1: Write failing component tests**

Create `src/features/scroll-story/PinnedCarStory.test.jsx`:

```jsx
/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import PinnedCarStory from './PinnedCarStory'

vi.mock('./usePinnedCarStory', () => ({ usePinnedCarStory: () => ({ storyRef: { current: null } }) }))

describe('PinnedCarStory', () => {
  it('renders all service states as real content', () => {
    render(<MemoryRouter><PinnedCarStory /></MemoryRouter>)
    expect(screen.getByText('From daily dirt to showroom finish.')).toBeInTheDocument()
    expect(screen.getByText('Paint protection film')).toBeInTheDocument()
    expect(screen.getByText('Ceramic coating')).toBeInTheDocument()
  })

  it('updates the package preview on focus', () => {
    render(<MemoryRouter><PinnedCarStory /></MemoryRouter>)
    fireEvent.focus(screen.getByRole('button', { name: 'Preview PPF package' }))
    expect(screen.getByTestId('package-preview')).toHaveAttribute('data-state', 'ppf')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/scroll-story/PinnedCarStory.test.jsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the layered visual**

Create `src/features/scroll-story/PinnedCarVisual.jsx` with one absolutely positioned image per manifest state. Each image must use `data-car-state`, `aria-hidden="true"`, `decoding="async"`, and `loading="lazy"` except the dirty state. Add code-native decorative elements with these class hooks: `story-mist`, `story-water-sweep`, `story-foam`, `story-swirl`, `story-ppf-coverage`, `story-gloss-sweep`, `story-droplets`, and `story-headlights`. Add a single visually hidden description: “A vehicle transforms from road-worn to washed, detailed, paint-protected, and ceramic-coated.”

- [ ] **Step 4: Implement the semantic story component**

Create `PinnedCarStory.jsx` that:

```jsx
const [previewState, setPreviewState] = useState('washed')
const { storyRef } = usePinnedCarStory()
```

Render `storyStages` as five `article` elements with `data-story-stage` and real heading/copy text. Render `PinnedCarVisual` once inside the pin stage. Add three detail inset elements labelled Paint correction, Interior restoration, and Wheel finish. Add existing PPF package names Basic, Premium, and Platinum. Render package buttons that set `previewState` on pointer enter, focus, and click, and use existing `/book`, `/services`, and `/packages` links.

- [ ] **Step 5: Run component tests**

Run: `npm test -- src/features/scroll-story/PinnedCarStory.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit static interaction**

```bash
git add src/features/scroll-story/PinnedCarVisual.jsx src/features/scroll-story/PinnedCarStory.jsx src/features/scroll-story/PinnedCarStory.test.jsx
git commit -m "feat: add semantic pinned car story"
```

### Task 5: Add the Scoped GSAP ScrollTrigger Lifecycle

**Files:**
- Create: `src/features/scroll-story/usePinnedCarStory.js`
- Modify: `src/features/scroll-story/PinnedCarStory.test.jsx`

- [ ] **Step 1: Add failing reduced-motion and lifecycle tests**

Mock `window.matchMedia`, `gsap.context`, and `ScrollTrigger.create`. Assert that reduced motion does not create a ScrollTrigger and standard motion creates one pin with `scrub: true`; assert cleanup calls the GSAP context’s `revert`.

- [ ] **Step 2: Run the hook tests to verify failure**

Run: `npm test -- src/features/scroll-story/PinnedCarStory.test.jsx`

Expected: FAIL because `usePinnedCarStory` does not exist.

- [ ] **Step 3: Implement the hook**

Create `usePinnedCarStory.js`:

```js
import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { storyStages } from './scrollStoryData'

gsap.registerPlugin(ScrollTrigger)

export function usePinnedCarStory() {
  const storyRef = useRef(null)

  useLayoutEffect(() => {
    const root = storyRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'none' } })
      storyStages.forEach((stage, index) => {
        if (index === 0) return
        timeline
          .to(`[data-car-state]:not([data-car-state="${stage.state}"])`, { opacity: 0, duration: stage.weight }, `stage-${index}`)
          .to(`[data-car-state="${stage.state}"]`, { opacity: 1, duration: stage.weight }, `stage-${index}`)
          .to(`[data-story-stage="${stage.id}"]`, { opacity: 1, y: 0, duration: stage.weight }, `stage-${index}`)
      })

      ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        animation: timeline,
        pin: root.querySelector('[data-pin-stage]'),
        scrub: true,
        invalidateOnRefresh: true,
      })
    }, root)

    return () => context.revert()
  }, [])

  return { storyRef }
}
```

Before the state loop, initialize the decorative layers with `gsap.set`. Add these transitions to the master timeline after the matching state crossfade:

```js
timeline
  .fromTo('.story-water-sweep', { xPercent: -130, opacity: 0 }, { xPercent: 130, opacity: 1, duration: .45 }, 'stage-1')
  .fromTo('.story-foam', { clipPath: 'inset(0 100% 0 0)', opacity: 0 }, { clipPath: 'inset(0 0% 0 0)', opacity: .8, duration: .3 }, 'stage-1')
  .to('.story-foam', { opacity: 0, duration: .25 }, 'stage-1+=.4')
  .to('.story-swirl', { opacity: 0, duration: 1.25 }, 'stage-2')
  .to('[data-car-stack]', { scale: 1.08, duration: 1.25 }, 'stage-2')
  .fromTo('.story-detail-insets', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .75 }, 'stage-2+=.35')
  .fromTo('.story-ppf-panel', { clipPath: 'inset(0 100% 0 0)', opacity: 0 }, { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: .45, stagger: .18 }, 'stage-3')
  .fromTo('.story-gloss-sweep', { xPercent: -140, opacity: 0 }, { xPercent: 140, opacity: .85, duration: .9 }, 'stage-4')
  .fromTo('.story-droplets', { opacity: 0, yPercent: -10 }, { opacity: 1, yPercent: 25, duration: 1.25 }, 'stage-4')
  .fromTo('.story-gloss-meter i', { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 1.25 }, 'stage-4')
```

Each stage transition also fades the previous `[data-story-stage]` to opacity `.18`, reveals the active stage at opacity `1`, and updates `--story-progress` on the root. The selectors remain scoped by `gsap.context`, and Carwash/PPF duration comes from `storyStages.weight`.

- [ ] **Step 4: Run lifecycle and component tests**

Run: `npm test -- src/features/scroll-story/PinnedCarStory.test.jsx`

Expected: PASS including reduced-motion and cleanup assertions.

- [ ] **Step 5: Commit the timeline**

```bash
git add src/features/scroll-story/usePinnedCarStory.js src/features/scroll-story/PinnedCarStory.test.jsx
git commit -m "feat: animate car story with ScrollTrigger"
```

### Task 6: Match the Existing Hakum Visual System

**Files:**
- Create: `src/features/scroll-story/scrollStory.css`
- Modify: `src/features/scroll-story/PinnedCarStory.jsx`

- [ ] **Step 1: Import the feature stylesheet**

Add at the top of `PinnedCarStory.jsx`:

```js
import './scrollStory.css'
```

- [ ] **Step 2: Implement the story styling**

Use current design tokens for display/body fonts, royal blue, shell width, and uppercase tracking. Define a dark charcoal full-width story, a sticky/pinned stage with `min-height: 100svh`, centered car layers using one shared `object-fit: contain` box, editorial copy aligned to the current `public-shell`, and sharp borders/radii consistent with existing service and PPF components. Reserve `#ccff00` and bright cyan for `.story-ppf-coverage` only.

Add responsive rules at the project’s existing `1100px`, `800px`, `600px`, and `500px` breakpoints. On mobile, reduce inset count and car scale while preserving all copy. Add `@media (prefers-reduced-motion: reduce)` rules that make every stage a normal-flow editorial section, show one matching state per stage, remove pin/sticky behavior, and suppress decorative motion layers.

- [ ] **Step 3: Run unit, lint, and build checks**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, ESLint reports no new errors, and Vite produces `dist` successfully.

- [ ] **Step 4: Commit styling**

```bash
git add src/features/scroll-story/scrollStory.css src/features/scroll-story/PinnedCarStory.jsx
git commit -m "style: align scroll story with Hakum site"
```

### Task 7: Insert the Story Without Reordering Existing Content

**Files:**
- Modify: `src/pages/PublicLandingPage.jsx`

- [ ] **Step 1: Add the component import**

```js
import PinnedCarStory from '../features/scroll-story/PinnedCarStory'
```

- [ ] **Step 2: Insert exactly after the closing hero section**

```jsx
</section>

<PinnedCarStory />

<section className="editorial-section about-section" id="about">
```

- [ ] **Step 3: Verify the source boundary**

Run:

```bash
rg -n "hero-stage|PinnedCarStory|about-section|queue-teaser" src/pages/PublicLandingPage.jsx
```

Expected: `PinnedCarStory` appears once, after `hero-stage` and before `about-section`; `queue-teaser` remains later in the existing order.

- [ ] **Step 4: Run regression checks**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all checks pass.

- [ ] **Step 5: Commit homepage integration**

```bash
git add src/pages/PublicLandingPage.jsx
git commit -m "feat: add scroll story after public hero"
```

### Task 8: Browser and Accessibility Verification

**Files:**
- Modify: `src/features/scroll-story/PinnedCarStory.jsx`
- Modify: `src/features/scroll-story/PinnedCarVisual.jsx`
- Modify: `src/features/scroll-story/usePinnedCarStory.js`
- Modify: `src/features/scroll-story/scrollStory.css`

- [ ] **Step 1: Start the local app and open it in the in-app browser**

Run: `npm run dev`

Verify the existing hero first, then scroll through all five states, package preview, About, Services, PPF visualizer, queue teaser, branches, and footer.

- [ ] **Step 2: Verify desktop fidelity and interactions**

At 1280×720 verify: unchanged hero/nav/copy/CTAs, story directly after hero, centered full vehicle, short Carwash pacing, long PPF pacing, cyan/lime used only for coverage, selector hover/focus/click behavior, clean unpin into About, and working `/services`, `/packages`, `/book`, and `/queue` navigation.

- [ ] **Step 3: Verify mobile and short-height layouts**

At 390×844 and 844×600 verify: no horizontal overflow, no clipped car or copy, fixed header remains usable, touch package selection works, and the story cleanly releases before About.

- [ ] **Step 4: Verify reduced motion**

Emulate `prefers-reduced-motion: reduce`. Verify no pinned ScrollTrigger, no water/mist/gloss/droplet motion, all five states/copy remain readable, and package controls still work.

- [ ] **Step 5: Inspect console and run final checks**

Confirm no browser console errors, GSAP warnings, failed asset requests, duplicate ScrollTriggers, or accessibility-name issues. Then run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all checks pass with no whitespace errors.

- [ ] **Step 6: Commit final QA fixes**

```bash
git add src/features/scroll-story src/pages/PublicLandingPage.jsx
git commit -m "fix: complete scroll story visual QA"
```
