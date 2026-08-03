# Public Homepage Reference Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the public homepage Hero, About Us, and Services typography, sizing, spacing, and composition with the approved reference pictures while keeping existing content and behavior.

**Architecture:** Preserve `PublicLandingPage` and the existing section structure. Add one presentational hero experience card and one layout wrapper, then make the remaining alignment through section-scoped CSS and responsive overrides. Existing project imagery stays in place during this pass; final user-supplied photography will be handled in a follow-up after those assets are uploaded.

**Tech Stack:** React 19, React Router, Vite 6, plain CSS, Node test runner, ESLint

## Global Constraints

- Change only the homepage Hero, About Us, and Services sections.
- Use only the user-supplied Benzin and Gilmer files already bundled under `public/fonts`.
- Keep the existing copy, links, branch-derived location label, milestone animation, service order, and accessibility semantics.
- Do not change the public header, later homepage sections, internal pages, routes, Supabase, or backend behavior.
- Use current project imagery temporarily; do not invent or download replacement photographs.
- Final image replacement and crop tuning begin only after the user uploads the complete image set.

---

### Task 1: Define and implement the hero experience composition

**Files:**
- Modify: `tests/publicBranding.test.js`
- Modify: `src/pages/PublicLandingPage.jsx:86-91`

**Interfaces:**
- Consumes: Existing `stats`, `AnimatedNumber`, and `StatCard` interfaces in `PublicLandingPage.jsx`.
- Produces: `.hero-experience-layout` and `.hero-experience-card` hooks consumed by Task 2 CSS.

- [ ] **Step 1: Write the failing markup contract test**

Append this test inside the existing `describe('Public branding assets and scope', ...)` block in `tests/publicBranding.test.js`:

```js
  it('includes the approved hero experience composition', async () => {
    const page = await readFile(projectFile('src/pages/PublicLandingPage.jsx'), 'utf8')

    assert.match(page, /className="hero-experience-layout"/)
    assert.match(page, /className="hero-experience-card"/)
    assert.match(page, /<strong>10 Years<\/strong>/)
    assert.match(page, /Auto Industry<\/span>/)
    assert.match(page, /Experience Combined<\/span>/)
    assert.equal((page.match(/<StatCard key=/g) || []).length, 1)
  })
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/publicBranding.test.js
```

Expected: FAIL in `includes the approved hero experience composition` because the two new class hooks do not exist.

- [ ] **Step 3: Add the minimal hero layout markup**

Replace the current `.hero-experience` contents in `src/pages/PublicLandingPage.jsx` with:

```jsx
        <div className="hero-experience" aria-labelledby="experience-heading">
          <div className="hero-experience-layout">
            <div className="hero-experience-card" aria-label="Ten years of combined auto industry experience">
              <strong>10 Years</strong>
              <span>Auto Industry</span>
              <span>Experience Combined</span>
            </div>
            <div>
              <h2 id="experience-heading">Experience</h2>
              <div className="hero-metrics" aria-label="Hakum milestones">
                {stats.map((stat) => <StatCard key={stat.label} value={<AnimatedNumber value={stat.value} suffix={stat.suffix}/>} label={stat.label}/>)}
              </div>
            </div>
          </div>
        </div>
```

- [ ] **Step 4: Run the focused test and lint the changed JSX**

Run:

```bash
node --test tests/publicBranding.test.js
npx eslint src/pages/PublicLandingPage.jsx tests/publicBranding.test.js
```

Expected: all public-branding tests pass and ESLint reports no errors.

- [ ] **Step 5: Commit the hero structure**

```bash
git add tests/publicBranding.test.js src/pages/PublicLandingPage.jsx
git commit -m "feat: align homepage hero experience structure"
```

---

### Task 2: Align desktop typography and proportions to the references

**Files:**
- Modify: `tests/publicBranding.test.js`
- Modify: `src/styles.css:116-184`

**Interfaces:**
- Consumes: `.hero-experience-layout` and `.hero-experience-card` from Task 1; existing `.about-*`, `.services-section`, `.section-heading-row`, and `.service-*` markup hooks.
- Produces: Desktop reference-aligned presentation for the three approved homepage sections.

- [ ] **Step 1: Write the failing section-style contract test**

Append this test to the same test suite:

```js
  it('scopes reference alignment to the approved homepage sections', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.match(css, /\.hero-experience-layout\s*\{[^}]*grid-template-columns:/s)
    assert.match(css, /\.hero-experience-card\s*\{[^}]*border:1px solid #37dfe8/s)
    assert.match(css, /\.about-heading \.section-title\s*\{[^}]*font-family:var\(--font-public-display\)/s)
    assert.match(css, /\.about-copy\s*\{[^}]*font-family:var\(--font-public-body\)/s)
    assert.match(css, /\.services-section \.section-title\s*\{[^}]*font-family:var\(--font-public-display\)/s)
    assert.match(css, /\.service-card h3\s*\{[^}]*font-family:var\(--font-public-display\)/s)
    assert.match(css, /\.service-card p\s*\{[^}]*font-family:var\(--font-public-body\)/s)
  })
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/publicBranding.test.js
```

Expected: FAIL because the experience-card selectors and explicit section font declarations are absent.

- [ ] **Step 3: Refine the hero desktop styles**

Update the hero rules in `src/styles.css` with these reference-aligned values while retaining the existing background image and gradients:

```css
.hero-content { width:min(100% - 48px,1280px); padding:132px 0 42px; text-align:center; }
.display-title { color:#f1f1f1; font-family:var(--font-public-display); font-size:clamp(3.5rem,6.35vw,6.4rem); font-style:italic; font-weight:800; line-height:.84; letter-spacing:-.045em; text-shadow:0 12px 38px rgba(0,0,0,.25); }
.hero-line-one { transform:skewX(-7deg); }
.hero-line-three { margin-top:.08em; font-size:.88em; transform:skewX(-7deg); }
.hero-subheading { max-width:650px; margin:34px auto 0; font-family:var(--font-public-body); font-size:clamp(8px,.72vw,10px); font-weight:300; font-style:normal; line-height:1.65; letter-spacing:.035em; text-transform:uppercase; }
.hero-actions { margin-top:27px; }
.hero-actions .ui-button { min-width:132px; min-height:42px; padding-inline:20px; font-size:8px; }
.hero-experience { width:min(100%,1060px); margin:48px auto 0; }
.hero-experience-layout { display:grid; grid-template-columns:190px minmax(0,1fr); gap:58px; align-items:center; }
.hero-experience-card { min-height:135px; padding:23px 18px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid #37dfe8; background:linear-gradient(145deg,rgba(5,38,153,.8),rgba(2,10,49,.88)); box-shadow:0 0 22px rgba(55,223,232,.28),0 18px 32px rgba(0,0,0,.36); }
.hero-experience-card strong { margin-bottom:9px; font-family:var(--font-public-display); font-size:24px; font-style:italic; font-weight:800; line-height:1; text-transform:uppercase; }
.hero-experience-card span { font-family:var(--font-public-body); font-size:10px; font-weight:300; font-style:italic; line-height:1.25; }
.hero-experience h2 { margin:0 0 25px; font-family:var(--font-public-display); font-size:clamp(25px,2.7vw,38px); font-weight:600; }
.hero-metrics { gap:clamp(20px,3vw,48px); }
.hero-metrics .ui-stat-card>strong { font-family:var(--font-public-display); font-size:clamp(19px,2vw,28px); font-weight:600; }
.hero-metrics .ui-stat-card>div>span { font-family:var(--font-public-body); font-size:clamp(7px,.62vw,9px); font-weight:300; }
```

- [ ] **Step 4: Refine the About Us and Services typography and sizing**

Apply these explicit section-scoped declarations in `src/styles.css`, merging them into the existing rules rather than creating duplicate selectors:

```css
.about-heading { margin-bottom:42px; }
.about-heading .section-title { font-family:var(--font-public-display); font-size:clamp(4.6rem,9.2vw,8.6rem); font-style:italic; font-weight:800; line-height:.78; letter-spacing:-.055em; }
.about-layout { grid-template-columns:minmax(0,1fr) minmax(430px,.96fr); }
.about-visual { min-height:600px; }
.about-copy { padding:clamp(44px,5.2vw,72px); font-family:var(--font-public-body); }
.about-copy p { font-family:var(--font-public-body); font-size:14px; font-weight:300; font-style:italic; line-height:1.55; }
.about-copy .about-lead { font-size:clamp(19px,1.7vw,24px); font-weight:500; line-height:1.25; }
.services-section .section-title { font-family:var(--font-public-display); font-size:clamp(4rem,6vw,6.25rem); font-style:normal; font-weight:800; line-height:.82; letter-spacing:-.045em; }
.services-section .section-heading-row>p { color:rgba(241,241,241,.58); font-family:var(--font-public-body); font-size:12px; font-weight:300; line-height:1.55; }
.service-grid { gap:14px; margin-top:58px; }
.service-card { box-shadow:none; }
.service-card-visual { height:220px; }
.service-card-body { min-height:205px; padding:22px 20px 20px; }
.service-card h3 { min-height:2em; font-family:var(--font-public-display); font-size:clamp(17px,1.35vw,22px); font-style:italic; font-weight:600; line-height:.92; }
.service-card p { margin:16px 0 20px; font-family:var(--font-public-body); font-size:10px; font-weight:300; line-height:1.55; }
```

- [ ] **Step 5: Run the focused tests and verify the desktop contract passes**

Run:

```bash
node --test tests/publicBranding.test.js tests/supabaseConfig.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Commit the desktop alignment**

```bash
git add tests/publicBranding.test.js src/styles.css
git commit -m "style: align homepage sections with brand references"
```

---

### Task 3: Complete responsive alignment and verification

**Files:**
- Modify: `tests/publicBranding.test.js`
- Modify: `src/styles.css:328-338`

**Interfaces:**
- Consumes: Desktop selectors and markup from Tasks 1-2.
- Produces: Tablet and mobile behavior for the reference-aligned sections.

- [ ] **Step 1: Write the failing responsive contract test**

Append this test to the same suite:

```js
  it('provides responsive layouts for the reference-aligned sections', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.match(css, /@media\(max-width:800px\)[^{]*\{[^}]*\.hero-experience-layout\s*\{[^}]*grid-template-columns:1fr/s)
    assert.match(css, /@media\(max-width:800px\)[^{]*\{[^}]*\.about-layout\s*\{[^}]*grid-template-columns:1fr/s)
    assert.match(css, /@media\(max-width:600px\)[^{]*\{[^}]*\.service-grid\s*\{[^}]*grid-template-columns:1fr/s)
  })
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/publicBranding.test.js
```

Expected: FAIL because `.hero-experience-layout` has no responsive override.

- [ ] **Step 3: Add tablet and mobile overrides**

Add readable multiline media blocks after the existing public homepage media rules:

```css
@media(max-width:800px){
  .hero-stage { min-height:1120px; }
  .hero-content { width:min(100% - 32px,700px); padding:126px 0 54px; }
  .display-title { font-size:clamp(3rem,11vw,5.6rem); }
  .hero-experience { margin-top:50px; }
  .hero-experience-layout { grid-template-columns:1fr; gap:38px; }
  .hero-experience-card { width:min(100%,220px); min-height:128px; margin-inline:auto; }
  .hero-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); gap:30px 18px; }
  .about-layout { grid-template-columns:1fr; }
  .about-copy { padding:clamp(36px,8vw,60px); }
  .services-section .section-heading-row { grid-template-columns:1fr; gap:28px; }
}

@media(max-width:600px){
  .service-grid { grid-template-columns:1fr; gap:18px; margin-top:44px; }
  .service-card-visual { height:250px; }
  .service-card-body { min-height:190px; }
}

@media(max-width:500px){
  .hero-stage { min-height:1180px; }
  .display-title { font-size:clamp(2.6rem,12.5vw,3.7rem); line-height:.88; }
  .hero-line-three { font-size:.84em; }
  .hero-subheading { margin-top:26px; }
  .hero-experience-card { width:min(100%,200px); }
  .about-heading .section-title { font-size:clamp(3.6rem,19vw,5.1rem); }
  .about-visual { min-height:330px; }
  .about-copy p { font-size:13px; }
  .services-section .section-title { font-size:clamp(3.4rem,17vw,4.7rem); }
}
```

Remove or merge older hero/About/Services media declarations that conflict with these values. Keep media rules for unrelated homepage and application sections unchanged.

- [ ] **Step 4: Run focused tests and lint**

Run:

```bash
node --test tests/publicBranding.test.js tests/supabaseConfig.test.js
npx eslint src/pages/PublicLandingPage.jsx tests/publicBranding.test.js tests/supabaseConfig.test.js
```

Expected: all tests pass and ESLint reports no errors.

- [ ] **Step 5: Build the production bundle**

Run:

```bash
npm run build
```

Expected: Vite finishes successfully and writes `dist/index.html`.

- [ ] **Step 6: Inspect desktop and mobile localhost views**

With the existing Vite server at `http://127.0.0.1:5173/`, inspect at approximately 1280×720 and 390×844. Confirm:

- The hero headline matches the reference scale without clipping.
- The cyan experience card and all four milestones are readable.
- About Us preserves the oversized heading and image/panel relationship.
- Services is four columns on wide desktop, two on tablet, and one on narrow mobile.
- No horizontal scrollbar appears.
- The header and the homepage sections after Services are unchanged.

- [ ] **Step 7: Commit the responsive pass**

```bash
git add tests/publicBranding.test.js src/styles.css
git commit -m "style: complete responsive homepage alignment"
```

---

### Deferred Follow-up: Final Photography

Do not execute this follow-up until the user uploads the complete source-image set. At that point, inventory the uploaded filenames, map each photo to Hero, About Us, or one of the eight service cards based on the approved references, copy optimized web assets into `src/assets`, replace the temporary `hakum-hero.webp` usages, tune each `background-position`, rerun the Task 3 verification commands, and compare every crop at desktop and mobile sizes. Because the source filenames and subjects are not available yet, this follow-up requires a plan amendment with exact asset paths before any image files are changed.
