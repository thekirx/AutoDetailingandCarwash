# Hakum Home Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the `/home` first viewport with the approved placeholder-backed Precision to Protection hero and stop before spending Higgsfield credits.

**Architecture:** `HomeHeroSection.jsx` owns semantic content, two stacked decorative video elements, playback handoff, and hero-scoped GSAP timelines. Existing global `styles.css` owns the three-layer visual architecture and responsive rules. A focused Node test renders the real component for semantic contracts and checks the animation source for lifecycle requirements that cannot run without a browser DOM.

**Tech Stack:** React 19, React Router, GSAP 3.15, ScrollTrigger, Node test runner, project CSS.

## Global Constraints

- Modify only the public home hero, its CSS selectors, its focused tests, and documentation.
- Do not modify `PPFVisualizer.jsx`, `BeforeAfterSlider.jsx`, `WordReveal.jsx`, `ProcessTimeline.jsx`, later home sections, staff/admin routes, or Supabase configuration.
- Use exactly one H1: `Pamper it. Protect it.`
- Use `Book a service` → `/book` and `Explore services` → `/services`.
- Two placeholder 1080p 16:9 clips represent one continuous ten-second sequence; do not call Higgsfield in this implementation pass.
- Clip one plays on load. ScrollTrigger only applies the unpinned `yPercent: 15` exit parallax and slight content fade.
- The existing `hakum-hero.webp` is the poster and error fallback.
- Decorative videos must be muted, inline, `aria-hidden="true"`, and `role="presentation"`.
- Reduced motion displays a clean poster still and uses opacity-only content entrance.
- Scope GSAP with `gsap.context()` and call `context.revert()`; remove pointer and video listeners on cleanup.

---

### Task 1: Lock the semantic and lifecycle contract

**Files:**
- Create: `tests/homeHeroSection.test.js`
- Modify: `src/components/public/home/HomeHeroSection.jsx`

**Interfaces:**
- Consumes: `PrimaryButton`, `SecondaryButton`, React refs/effects, GSAP, ScrollTrigger.
- Produces: default `HomeHeroSection` component with no props and placeholder constants `HERO_CLIP_ONE` and `HERO_CLIP_TWO`.

- [ ] **Step 1: Write the failing component test**

Create a Node test that renders the real component inside `MemoryRouter` and asserts one H1, exact approved copy, two destination links, two presentation videos, placeholder paths, and poster fallback. Add a lifecycle contract test that reads `HomeHeroSection.jsx` and asserts `gsap.context`, `context.revert`, `ScrollTrigger`, `yPercent: 15`, `prefers-reduced-motion`, and listener removal.

```js
const html = renderToStaticMarkup(
  <MemoryRouter><HomeHeroSection /></MemoryRouter>,
)
assert.equal((html.match(/<h1/g) || []).length, 1)
assert.match(html, /Pamper it\. Protect it\./)
assert.match(html, /href="\/book"/)
assert.match(html, /href="\/services"/)
assert.equal((html.match(/role="presentation"/g) || []).length, 2)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/homeHeroSection.test.js`

Expected: FAIL because the current hero has the old headline, metrics, and no video elements or GSAP lifecycle.

- [ ] **Step 3: Implement the semantic media layers and scoped animation**

Replace the current metrics-driven component with:

```jsx
const HERO_CLIP_ONE = '/media/hero/PLACEHOLDER-hakum-precision-01.mp4'
const HERO_CLIP_TWO = '/media/hero/PLACEHOLDER-hakum-protection-02.mp4'
const HERO_POSTER = new URL('../../../assets/hakum-hero.webp', import.meta.url).href

export default function HomeHeroSection() {
  // refs, media handoff, reduced-motion branch, hero-scoped entrance,
  // pointer parallax, tint loop, and unpinned ScrollTrigger cleanup
  return (
    <section id="hero" className="hero-stage hero-cinematic" aria-label="Hakum Auto Care introduction">
      {/* media layer, treatment layer, semantic content layer */}
    </section>
  )
}
```

Use two stacked video refs. On `ended`, prepare and play the other video, then exchange active classes. On media error, mark the media wrapper as fallback-only. Attach all listeners in the effect and remove them in cleanup. In reduced motion, do not attach playback, pointer, tint-loop, or ScrollTrigger behavior.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/homeHeroSection.test.js`

Expected: PASS with all semantic and lifecycle assertions satisfied.

- [ ] **Step 5: Commit the component contract**

```bash
git add tests/homeHeroSection.test.js src/components/public/home/HomeHeroSection.jsx
git commit -m "feat: build cinematic home hero structure"
```

---

### Task 2: Implement the approved three-layer visual system

**Files:**
- Modify: `src/styles.css`
- Test: `tests/homeHeroSection.test.js`

**Interfaces:**
- Consumes: `hero-cinematic`, `hero-cinematic-media`, `hero-cinematic-overlay`, `hero-cinematic-gloss`, `hero-cinematic-content`, and active/fallback classes from Task 1.
- Produces: full-bleed desktop media, persistent AA overlay, left-aligned content, and responsive/reduced-motion presentation.

- [ ] **Step 1: Add a failing stylesheet behavior test**

Extend the focused test to require the persistent multi-stop dark overlay, `object-fit: cover`, left-side content width near 42%, focus-visible states, and a reduced-motion still-image rule.

```js
assert.match(css, /\.hero-cinematic-overlay[\s\S]*linear-gradient/)
assert.match(css, /\.hero-cinematic-video[\s\S]*object-fit:\s*cover/)
assert.match(css, /\.hero-cinematic-copy[\s\S]*max-width:\s*42%/)
assert.match(css, /prefers-reduced-motion:\s*reduce/)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/homeHeroSection.test.js`

Expected: FAIL because the new hero selectors do not yet exist in `styles.css`.

- [ ] **Step 3: Add scoped hero CSS**

Replace the old hero-stage/media/content/metrics rules with scoped cinematic rules. Keep static positioning and dimensions in CSS; animate only opacity and transforms. Use a persistent left-heavy gradient over the media, a separate tint layer, a restrained gloss element, Benzin/Gilmer tokens, and focus-visible outlines. Below 768 px, hide video and show the poster fallback because mobile-specific media is deferred.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/homeHeroSection.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the visual system**

```bash
git add src/styles.css tests/homeHeroSection.test.js
git commit -m "style: finish precision to protection hero"
```

---

### Task 3: Integrate and verify without generated media

**Files:**
- Modify only if verification finds an in-scope defect: `src/components/public/home/HomeHeroSection.jsx`, `src/styles.css`, `tests/homeHeroSection.test.js`

**Interfaces:**
- Consumes: completed component and styles from Tasks 1–2.
- Produces: reviewable placeholder-backed hero with no Higgsfield spend.

- [ ] **Step 1: Run focused and relevant regression tests**

Run:

```bash
node --test tests/homeHeroSection.test.js tests/publicHomeContent.test.js tests/homepageContent.test.js tests/ppfCinematicSection.test.js tests/ppfScrollStory.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Run lint and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit successfully with no new hero-related warnings or errors.

- [ ] **Step 3: Verify the rendered desktop hero**

Start Vite, load `/home` at 1280×720 and 1440×900, and confirm: poster fallback is present with missing placeholder clips; one H1; both CTAs work; hero is not pinned; scroll parallax exits at 15%; later PPF behavior remains separate; no console errors; reduced motion shows the still fallback.

- [ ] **Step 4: Inspect the final diff and prohibited files**

Run `git diff --name-only HEAD~2..HEAD` plus `git status --short`. Confirm no prohibited file or configuration changed and no video generation/download exists.

- [ ] **Step 5: Stop for user review**

Deliver the live-site read-back, final component file link, CSS/test links, GSAP/Motion coexistence note, verification evidence, and explicit confirmation that Higgsfield usage remains zero for this pass.
