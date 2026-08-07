# Homepage Services Responsive Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three approved homepage service areas fluid and readable across desktop and mobile, enlarge the Services intro copy, make Other Services informational only, and reveal more image detail in ceramic packages.

**Architecture:** Keep the existing React data flow and component structure in `PublicLandingPage.jsx`. Enforce behavior with static source contracts in `tests/publicBranding.test.js`, then refine only the scoped CSS selectors with fluid sizing, container constraints, and breakpoint-specific layout changes.

**Tech Stack:** React 19, React Router, CSS, Node test runner, Vite, in-app Browser runtime.

## Global Constraints

- Modify only Main Services, Other Services modal, Ceramic Coating Packages, and their tests/docs.
- Preserve the existing images, copy, modal accessibility behavior, and unrelated homepage sections.
- Other Services cards are informational only: no Book Now links and no card click actions.
- Verify desktop, compact desktop/tablet, and mobile without scoped clipping, overlap, or horizontal overflow.

---

### Task 1: Informational Other Services Cards

**Files:**
- Modify: `tests/publicBranding.test.js`
- Modify: `src/pages/PublicLandingPage.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `otherServices: Array<{ title, copy, image, imageAlt }>` from `src/data/publicHomeContent.js`.
- Produces: four non-interactive `.other-service-card` articles inside the existing accessible modal.

- [ ] **Step 1: Write the failing source contract**

Add assertions to the existing homepage composition test:

```js
assert.doesNotMatch(page, /<Link to="\/book"[^>]*>Book now/)
assert.doesNotMatch(css, /\.other-service-card a\s*\{/)
assert.match(css, /\.other-service-card>div\s*\{[^}]*min-height:auto/s)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/publicBranding.test.js`

Expected: FAIL because each Other Services card still renders a Book Now link and link-specific CSS remains.

- [ ] **Step 3: Remove the interactive affordance**

In `PublicLandingPage.jsx`, leave each card with image, heading, and copy only:

```jsx
<article className="other-service-card" key={service.title}>
  <img src={service.image} alt={service.imageAlt} loading="lazy" decoding="async" />
  <div>
    <h3>{service.title}</h3>
    <p>{service.copy}</p>
  </div>
</article>
```

Remove `.other-service-card a`, SVG, hover, and focus rules. Change the card body from fixed minimum heights to content-driven spacing.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/publicBranding.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the behavior change**

```bash
git add tests/publicBranding.test.js src/pages/PublicLandingPage.jsx src/styles.css
git commit -m "Make other services informational"
```

### Task 2: Fluid Services and Ceramic Layout Contracts

**Files:**
- Modify: `tests/publicBranding.test.js`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: existing `.services-*`, `.featured-service-*`, `.ceramic-*`, and `.other-services-*` class names.
- Produces: fluid desktop sizing plus explicit 1200 px, 900 px, 700 px, and 520 px responsive states.

- [ ] **Step 1: Write failing responsive CSS contracts**

Add assertions that require the new fluid rules:

```js
assert.match(css, /\.services-eyebrow\s*\{[^}]*font-size:clamp\(/s)
assert.match(css, /\.services-intro-copy\s*\{[^}]*font-size:clamp\(/s)
assert.match(css, /\.ceramic-package-overlay\s*\{[^}]*rgba\(5,38,153,\.3/s)
assert.match(css, /@media\(max-width:900px\)\{[\s\S]*?\.ceramic-package-grid\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
assert.match(css, /@media\(max-width:700px\)\{[\s\S]*?\.featured-services-grid\s*\{[^}]*grid-template-columns:1fr/)
assert.match(css, /@media\(max-width:700px\)\{[\s\S]*?\.ceramic-package-grid\s*\{[^}]*grid-template-columns:1fr/)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/publicBranding.test.js`

Expected: FAIL because intro sizes are fixed, the ceramic overlay is more opaque than `.3`, and the new breakpoint contracts do not exist.

- [ ] **Step 3: Implement fluid Main Services sizing**

Update only the Services selectors:

```css
.services-intro { padding:clamp(52px,6vw,92px) 0 clamp(46px,5vw,76px); }
.services-eyebrow { font-size:clamp(12px,.95vw,16px); }
.services-display-title { max-width:100%; font-size:clamp(4rem,8vw,8.2rem); }
.services-intro-copy { width:min(100% - 32px,700px); font-size:clamp(12px,.95vw,16px); }
.featured-service-card { min-height:clamp(480px,55vw,780px); aspect-ratio:auto; }
```

At `700px`, stack the cards and use a bounded mobile title size that fits its container without overflow.

- [ ] **Step 4: Implement fluid ceramic layout and lighter tint**

Use a bounded desktop container, resilient columns, and the lighter overlay:

```css
.ceramic-layout { grid-template-columns:minmax(280px,.9fr) minmax(0,2.1fr); }
.ceramic-package-overlay { background:linear-gradient(180deg,rgba(5,38,153,.3),rgba(3,29,120,.46) 52%,rgba(2,14,70,.82)); }
.ceramic-package-body { grid-template-columns:clamp(54px,5vw,86px) minmax(0,1fr); }
```

At `900px`, stack the intro above the still-three-column package grid. At `700px`, stack packages into one column, size panels with `clamp()`, and preserve readable vertical names and copy without overlap.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/publicBranding.test.js tests/publicHomeContent.test.js`

Expected: 13 tests pass.

- [ ] **Step 6: Commit the responsive refinement**

```bash
git add tests/publicBranding.test.js src/styles.css
git commit -m "Refine responsive homepage service layouts"
```

### Task 3: Rendered QA and Release Verification

**Files:**
- Verify: `src/pages/PublicLandingPage.jsx`
- Verify: `src/styles.css`
- Verify: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: the completed scoped responsive implementation.
- Produces: browser evidence and a validated build ready to push to the existing feature branch and PR.

- [ ] **Step 1: Start the exact local preview host**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite serves the homepage on `http://127.0.0.1:5173/`.

- [ ] **Step 2: Verify desktop and compact desktop states in Browser**

Check 2048×1080, 1440×900, 1024×768, and 768×900. Confirm Services intro hierarchy, card cropping, ceramic panel text, lighter tint, modal columns, and no scoped horizontal overflow.

- [ ] **Step 3: Verify mobile states and modal interaction in Browser**

Check 430×932, 390×844, and 320×740. Open Other Services, confirm four informational cards and no Book Now text, press Escape, confirm the modal closes, body scrolling returns, and focus returns to the trigger.

- [ ] **Step 4: Run automated verification**

```bash
node --test tests/publicHomeContent.test.js tests/publicBranding.test.js
rg --files tests -g '*.test.js' -g '!pushAuth.test.js' | xargs node --test
npx eslint src/pages/PublicLandingPage.jsx src/data/publicHomeContent.js tests/publicHomeContent.test.js tests/publicBranding.test.js
npm run build
git diff --check
```

Expected: focused tests, 258-test local suite, targeted lint, build, and whitespace checks pass.

- [ ] **Step 5: Commit any QA-only corrections and push**

```bash
git add src/pages/PublicLandingPage.jsx src/styles.css tests/publicBranding.test.js
git commit -m "Polish responsive services presentation"
git push
```

Expected: `agent/homepage-services-redesign` updates the existing draft PR.
