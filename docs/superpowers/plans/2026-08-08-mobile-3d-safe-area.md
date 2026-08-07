# Mobile 3D Viewer and iPhone Safe-Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the existing interactive PPF vehicle model on mobile and extend the Hakum-blue public header behind the iPhone status area while keeping controls inside the safe area.

**Architecture:** Keep one shared React Three Fiber viewer for every viewport and delete the mobile-only diagram path. Enable iOS edge-to-edge layout in document metadata, then make the existing fixed public header safe-area-aware through CSS without changing its navigation structure.

**Tech Stack:** React 19, React Three Fiber, Drei/OrbitControls, Three.js, Vite, CSS, Node test runner

## Global Constraints

- No flat image, poster, or diagram fallback on mobile.
- Preserve the current desktop viewer, model, package data, auto-rotation, drag rotation, panel inspection, attribution, and booking flow.
- Preserve the current translucent Hakum-blue header design and its 88px desktop / 76px small-mobile control-row heights.
- Do not add dependencies.
- Do not deploy or publish.

---

### Task 1: Use the interactive PPF canvas on mobile

**Files:**
- Create: `tests/mobilePublicExperience.test.js`
- Modify: `src/components/PPFVisualizer.jsx:193-198`
- Modify: `src/styles.css:249-262, 409-418`

**Interfaces:**
- Consumes: Existing `Canvas`, `OrbitControls`, `Car`, package selection state, and `.ppf-canvas-stage` container.
- Produces: A single `.ppf-canvas-stage` visualization path that remains visible at widths below 500px.

- [ ] **Step 1: Write the failing mobile-viewer regression test**

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

describe('Mobile public experience', () => {
  it('keeps the interactive PPF canvas on mobile without a flat diagram', async () => {
    const [component, css] = await Promise.all([
      readFile(projectFile('src/components/PPFVisualizer.jsx'), 'utf8'),
      readFile(projectFile('src/styles.css'), 'utf8'),
    ])

    assert.match(component, /className="ppf-canvas-stage"/)
    assert.doesNotMatch(component, /ppf-mobile-diagram/)
    assert.doesNotMatch(css, /\.ppf-canvas-stage\s*\{\s*display:none/)
    assert.doesNotMatch(css, /\.ppf-mobile-diagram/)
    assert.match(css, /@media\(max-width:500px\)[\s\S]*?\.ppf-canvas-stage\s*\{[^}]*touch-action:none/)
  })
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/mobilePublicExperience.test.js`

Expected: FAIL because the component and CSS still contain `ppf-mobile-diagram`, and the mobile rule hides the canvas.

- [ ] **Step 3: Remove the diagram path and make the canvas touch-interactive**

In `PPFVisualizer.jsx`, delete the complete `ppf-mobile-diagram` element while leaving `.ppf-canvas-stage`, the tooltip, legend, and attribution intact.

In `src/styles.css`, delete all base `.ppf-mobile-diagram` and `.ppf-diagram-car` rules. In the `max-width:500px` block, replace the hidden-canvas and displayed-diagram declarations with:

```css
.ppf-canvas-stage { display:block; touch-action:none; }
.ppf-canvas-stage canvas { display:block; width:100% !important; height:100% !important; }
```

Keep the mobile viewer label, legend, and attribution above the canvas using their existing z-index rules.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `node --test tests/mobilePublicExperience.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the mobile viewer change**

```bash
git add tests/mobilePublicExperience.test.js src/components/PPFVisualizer.jsx src/styles.css
git commit -m "fix: keep ppf viewer interactive on mobile"
```

---

### Task 2: Extend the public header through the iPhone safe area

**Files:**
- Modify: `tests/mobilePublicExperience.test.js`
- Modify: `index.html:5`
- Modify: `src/styles.css:80-82, 374, 388-390`

**Interfaces:**
- Consumes: Existing `.public-header`, `.header-inner`, and `.mobile-nav` layout rules.
- Produces: `viewport-fit=cover` metadata and top-safe-area-aware header/menu sizing using `env(safe-area-inset-top, 0px)`.

- [ ] **Step 1: Add the failing safe-area regression test**

Append this test inside the existing `describe` block:

```js
it('extends the Hakum header behind the iPhone status area safely', async () => {
  const [html, css] = await Promise.all([
    readFile(projectFile('index.html'), 'utf8'),
    readFile(projectFile('src/styles.css'), 'utf8'),
  ])

  assert.match(html, /width=device-width, initial-scale=1\.0, viewport-fit=cover/)
  assert.match(css, /\.public-header\s*\{[^}]*padding-top:env\(safe-area-inset-top, 0px\)/s)
  assert.match(css, /\.mobile-nav\s*\{[^}]*safe-area-inset-top/s)
})
```

- [ ] **Step 2: Run the focused test and confirm the new assertion fails**

Run: `node --test tests/mobilePublicExperience.test.js`

Expected: FAIL because the viewport and safe-area CSS are not present.

- [ ] **Step 3: Implement edge-to-edge metadata and header padding**

Change the viewport meta tag in `index.html` to:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Add `padding-top:env(safe-area-inset-top, 0px)` to `.public-header`. Update both mobile-menu maximum-height declarations to subtract the control-row height and the top inset:

```css
.mobile-nav { max-height:calc(100dvh - 88px - env(safe-area-inset-top, 0px)); }
```

and in the `max-width:500px` rule:

```css
.mobile-nav { max-height:calc(100dvh - 76px - env(safe-area-inset-top, 0px)); }
```

Do not add safe-area padding to `.header-inner`; the parent padding keeps its existing measured height and places it below the status area.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `node --test tests/mobilePublicExperience.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the safe-area change**

```bash
git add tests/mobilePublicExperience.test.js index.html src/styles.css
git commit -m "fix: extend public header through ios safe area"
```

---

### Task 3: Verify the complete responsive experience

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: The mobile viewer and safe-area implementations from Tasks 1 and 2.
- Produces: Evidence that automated checks, production compilation, and rendered mobile/desktop behavior are healthy.

- [ ] **Step 1: Run the relevant and full automated checks**

Run:

```bash
node --test tests/mobilePublicExperience.test.js
npm test --if-present
npm run lint
npm run build
```

Expected: All configured checks pass and Vite produces a production bundle.

- [ ] **Step 2: Start the local Vite server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports a local URL without a startup error.

- [ ] **Step 3: Verify the target flow at mobile and desktop sizes**

Target flow: homepage loads → scroll to Paint Protection Film Packages → the real Mazda model auto-rotates → drag changes its angle → selecting Basic/Premium/Platinum changes visible coverage → header background occupies the top safe-area region while controls remain below it.

Use a 430×932 mobile viewport and a 1440×900 desktop viewport. Check page identity, meaningful DOM content, no framework overlay, console health, screenshot evidence, and the interaction state after dragging and switching a package.

- [ ] **Step 4: Review the final diff and repository state**

Run:

```bash
git diff --check
git status --short
git log -3 --oneline
```

Expected: No whitespace errors; only intentional changes are present; both implementation commits are recorded.
