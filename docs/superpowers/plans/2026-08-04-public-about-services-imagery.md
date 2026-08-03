# Public About Us and Services Imagery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace temporary homepage imagery with the supplied Hakum photos and reproduce the approved About Us and Services references.

**Architecture:** Store optimized local WebP assets in focused About and Services asset directories. Move homepage service metadata into a small data module so file mapping and availability can be tested independently, then render photographic and locked cards from that data. Keep all layout changes scoped to the existing public homepage selectors.

**Tech Stack:** React 19, Vite 6, CSS, Node test runner, Google Drive connector, macOS `sips`

## Global Constraints

- Work only in the `AlignedWithBranding` worktree and branch.
- Change only the public homepage About Us and Services sections; do not change backend, authentication, booking APIs, database, or staff screens.
- Preserve the approved hero composition and headline typography.
- Preserve the pending Gilmer Regular and legacy italic/upright typography pass.
- Use `HKM-21.jpg` for About Us and the seven filename-matched service photos for their named cards.
- Keep Mobile Detailing as a locked dark-blue card without an active booking link.
- Store optimized local WebP assets; the finished website must not depend on Google Drive at runtime.
- Desktop Services layout is four columns, tablet is two columns, and phone is one column.

---

## File Structure

- Create `src/assets/about/about-hkm-21.webp`: optimized About Us image.
- Create `src/assets/services/*.webp`: seven optimized service images.
- Create `src/data/publicHomeContent.js`: tested service metadata, local image URLs, alt text, and availability.
- Modify `src/pages/PublicLandingPage.jsx`: consume the content module and render About/Services states.
- Modify `src/styles.css`: reproduce the approved split About panel and 4-by-2 Services cards.
- Modify `tests/publicBranding.test.js`: protect reference-specific layout and visual-state contracts.
- Create `tests/publicHomeContent.test.js`: verify asset existence, filename mapping, and Mobile Detailing availability.

### Task 1: Commit the approved typography baseline

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: the already-present uncommitted Gilmer Regular and legacy italic/upright changes.
- Produces: a clean committed baseline for the imagery tasks.

- [ ] **Step 1: Review the existing diff and confirm it is typography-only**

Run:

```bash
git diff -- src/styles.css tests/publicBranding.test.js
git diff --check
```

Expected: only the approved Gilmer `400` body copy and legacy italic/upright rules plus their assertions; no About/Services image implementation.

- [ ] **Step 2: Re-run the typography regression test**

Run:

```bash
node --test tests/publicBranding.test.js
```

Expected: 8 tests pass, 0 fail.

- [ ] **Step 3: Commit the baseline**

```bash
git add src/styles.css tests/publicBranding.test.js
git commit -m "style: align public typography with legacy reference"
```

### Task 2: Import and optimize the approved Drive assets

**Files:**
- Create: `src/assets/about/about-hkm-21.webp`
- Create: `src/assets/services/carwash.webp`
- Create: `src/assets/services/interior-detailing.webp`
- Create: `src/assets/services/ceramic-tint.webp`
- Create: `src/assets/services/ceramic-coating.webp`
- Create: `src/assets/services/glass-detailing.webp`
- Create: `src/assets/services/engine-wash.webp`
- Create: `src/assets/services/paint-protection-film.webp`
- Modify: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: Google Drive folder `1T0pXIzwCzX8XMXWwx8AQjm91Jbi6DI2l` and the exact file IDs below.
- Produces: eight repository-local WebP files consumed by `publicHomeContent.js`.

- [ ] **Step 1: Write the failing asset-presence test**

Extend the `assets` array in `tests/publicBranding.test.js` with these exact paths:

```js
'src/assets/about/about-hkm-21.webp',
'src/assets/services/carwash.webp',
'src/assets/services/interior-detailing.webp',
'src/assets/services/ceramic-tint.webp',
'src/assets/services/ceramic-coating.webp',
'src/assets/services/glass-detailing.webp',
'src/assets/services/engine-wash.webp',
'src/assets/services/paint-protection-film.webp',
```

- [ ] **Step 2: Run the test and verify the missing assets cause failure**

Run:

```bash
node --test tests/publicBranding.test.js
```

Expected: FAIL in `ships the approved logo and required web fonts` with `ENOENT` for the first new image path.

- [ ] **Step 3: Fetch the eight source files through Google Drive**

Use `google_drive.fetch` with `download_raw_file=true` and `include_base64=false` for each file, then materialize each returned authenticated `file_uri` into a new temporary directory created with `mktemp -d`. Do not use or expose public bearer download URLs.

| Source | Drive file ID | Temporary filename |
| --- | --- | --- |
| `HKM-21.jpg` | `1dxGtX-kdTbaDmerLJE58OT_MR1IN4j09` | `about-hkm-21.jpg` |
| `Car Wash.jpg` | `11D0cf6_jVs4L2vFzNZhiz0lGKvpe7aiy` | `carwash.jpg` |
| `Interior Detailing.jpg` | `1dddZZu3x-2IRrFT3YYPAzq-Cd1_qTih4` | `interior-detailing.jpg` |
| `Ceramic tint.jpg` | `1oRutLyxJ6uext0v26Bo2w9WKS7UFeT2n` | `ceramic-tint.jpg` |
| `Ceramic Coating.jpg` | `1fXw5UGcD4n6-X1g1btigmT1Z-w9p8CnX` | `ceramic-coating.jpg` |
| `Glass Detailing.jpg` | `1i9FjTCFBwOq4uP4vAThZoeNu_DycTOLd` | `glass-detailing.jpg` |
| `Engine Wash.jpg` | `1chZ-Iw24yeucUATolJKkSR-ZnvV7aI_i` | `engine-wash.jpg` |
| `PPF.jpg` | `11I-TYaVSU4FILg_38_nP3ciwnWyMnfga` | `paint-protection-film.jpg` |

- [ ] **Step 4: Create asset directories and optimize to WebP**

With the temporary directory path stored in `HAKUM_IMAGE_TMP`, run these commands from the repository root:

```bash
mkdir -p src/assets/about src/assets/services
sips -s format webp -s formatOptions 82 -Z 1800 "$HAKUM_IMAGE_TMP/about-hkm-21.jpg" --out src/assets/about/about-hkm-21.webp
sips -s format webp -s formatOptions 82 -Z 1200 "$HAKUM_IMAGE_TMP/carwash.jpg" --out src/assets/services/carwash.webp
sips -s format webp -s formatOptions 82 -Z 1200 "$HAKUM_IMAGE_TMP/interior-detailing.jpg" --out src/assets/services/interior-detailing.webp
sips -s format webp -s formatOptions 82 -Z 1200 "$HAKUM_IMAGE_TMP/ceramic-tint.jpg" --out src/assets/services/ceramic-tint.webp
sips -s format webp -s formatOptions 82 -Z 1200 "$HAKUM_IMAGE_TMP/ceramic-coating.jpg" --out src/assets/services/ceramic-coating.webp
sips -s format webp -s formatOptions 82 -Z 1200 "$HAKUM_IMAGE_TMP/glass-detailing.jpg" --out src/assets/services/glass-detailing.webp
sips -s format webp -s formatOptions 82 -Z 1200 "$HAKUM_IMAGE_TMP/engine-wash.jpg" --out src/assets/services/engine-wash.webp
sips -s format webp -s formatOptions 82 -Z 1200 "$HAKUM_IMAGE_TMP/paint-protection-film.jpg" --out src/assets/services/paint-protection-film.webp
```

- [ ] **Step 5: Validate file types and dimensions**

Run:

```bash
file src/assets/about/about-hkm-21.webp src/assets/services/*.webp
sips -g pixelWidth -g pixelHeight src/assets/about/about-hkm-21.webp src/assets/services/*.webp
```

Expected: every file reports WebP; About longest edge is at most 1800px and each service longest edge is at most 1200px.

- [ ] **Step 6: Run the asset test**

Run:

```bash
node --test tests/publicBranding.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit optimized assets**

```bash
git add tests/publicBranding.test.js src/assets/about src/assets/services
git commit -m "assets: add approved About and service photography"
```

### Task 3: Add tested homepage content metadata

**Files:**
- Create: `src/data/publicHomeContent.js`
- Create: `tests/publicHomeContent.test.js`

**Interfaces:**
- Produces: `aboutImage: string` and `services: Array<{number: string, title: string, copy: string, image: string|null, imageAlt: string|null, available: boolean}>`.
- Consumed by: `PublicLandingPage.jsx` in Task 4.

- [ ] **Step 1: Write the failing content mapping test**

Create `tests/publicHomeContent.test.js`:

```js
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { aboutImage, services } from '../src/data/publicHomeContent.js'

describe('Public homepage content assets', () => {
  it('maps seven available services to local images', async () => {
    const available = services.filter((service) => service.available)
    assert.equal(available.length, 7)
    assert.deepEqual(available.map((service) => service.title), [
      'Carwash',
      'Interior Detailing',
      'Ceramic Tint',
      'Ceramic Coating',
      'Glass Detailing',
      'Engine Wash',
      'Paint Protection Film',
    ])
    assert.ok(available.every((service) => service.imageAlt?.includes(service.title)))
    await Promise.all(available.map((service) => access(new URL(service.image))))
  })

  it('keeps Mobile Detailing locked without an image', () => {
    const mobile = services.find((service) => service.title === 'Mobile Detailing')
    assert.deepEqual(mobile, {
      number: '08',
      title: 'Mobile Detailing',
      copy: 'Premium Hakum car care delivered where it is most convenient.',
      image: null,
      imageAlt: null,
      available: false,
    })
  })

  it('maps the dedicated About Us image', async () => {
    assert.match(new URL(aboutImage).pathname, /about-hkm-21\.webp$/)
    await access(new URL(aboutImage))
  })
})
```

- [ ] **Step 2: Run the test and verify the missing module causes failure**

Run:

```bash
node --test tests/publicHomeContent.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/data/publicHomeContent.js`.

- [ ] **Step 3: Create the content data module**

Create `src/data/publicHomeContent.js`:

```js
export const aboutImage = new URL('../assets/about/about-hkm-21.webp', import.meta.url).href

export const services = [
  { number: '01', title: 'Carwash', copy: 'A careful exterior clean that brings back a crisp, spotless finish.', image: new URL('../assets/services/carwash.webp', import.meta.url).href, imageAlt: 'Carwash service at Hakum Auto Care', available: true },
  { number: '02', title: 'Interior Detailing', copy: 'Deep cabin care for cleaner surfaces, fresher air, and renewed comfort.', image: new URL('../assets/services/interior-detailing.webp', import.meta.url).href, imageAlt: 'Interior Detailing service at Hakum Auto Care', available: true },
  { number: '03', title: 'Ceramic Tint', copy: 'Heat-rejecting tint with lasting clarity, comfort, and UV protection.', image: new URL('../assets/services/ceramic-tint.webp', import.meta.url).href, imageAlt: 'Ceramic Tint service at Hakum Auto Care', available: true },
  { number: '04', title: 'Ceramic Coating', copy: 'Long-term gloss and hydrophobic protection for everyday driving.', image: new URL('../assets/services/ceramic-coating.webp', import.meta.url).href, imageAlt: 'Ceramic Coating service at Hakum Auto Care', available: true },
  { number: '05', title: 'Glass Detailing', copy: 'Polished, decontaminated glass for sharper vision in every condition.', image: new URL('../assets/services/glass-detailing.webp', import.meta.url).href, imageAlt: 'Glass Detailing service at Hakum Auto Care', available: true },
  { number: '06', title: 'Engine Wash', copy: 'A precise, component-safe clean for a neater engine bay.', image: new URL('../assets/services/engine-wash.webp', import.meta.url).href, imageAlt: 'Engine Wash service at Hakum Auto Care', available: true },
  { number: '07', title: 'Paint Protection Film', copy: 'Virtually invisible impact protection for the paint that matters most.', image: new URL('../assets/services/paint-protection-film.webp', import.meta.url).href, imageAlt: 'Paint Protection Film service at Hakum Auto Care', available: true },
  { number: '08', title: 'Mobile Detailing', copy: 'Premium Hakum car care delivered where it is most convenient.', image: null, imageAlt: null, available: false },
]
```

- [ ] **Step 4: Run the content test**

Run:

```bash
node --test tests/publicHomeContent.test.js
```

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the content module**

```bash
git add src/data/publicHomeContent.js tests/publicHomeContent.test.js
git commit -m "feat: map homepage content to approved imagery"
```

### Task 4: Render the About image and available/locked service cards

**Files:**
- Modify: `src/pages/PublicLandingPage.jsx`
- Modify: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: `aboutImage` and `services` from `src/data/publicHomeContent.js`.
- Produces: `.about-visual-image`, `.service-card-visual img`, and `.service-card-locked` DOM hooks for Task 5 styling.

- [ ] **Step 1: Write the failing rendering contract test**

Add these assertions to the homepage composition test in `tests/publicBranding.test.js`:

```js
assert.match(page, /import \{ aboutImage, services \} from '\.\.\/data\/publicHomeContent'/)
assert.match(page, /<img className="about-visual-image" src=\{aboutImage\}/)
assert.match(page, /service\.available\s*\?\s*<img/)
assert.match(page, /className="service-card-locked"/)
assert.match(page, /service\.available\s*&&\s*<Link to="\/book">/)
assert.doesNotMatch(page, /--service-position/)
```

- [ ] **Step 2: Run the test and verify it fails on the old renderer**

Run:

```bash
node --test tests/publicBranding.test.js
```

Expected: FAIL because the content import and new image/locked markup are absent.

- [ ] **Step 3: Replace page-local service metadata and icon imports**

In `PublicLandingPage.jsx`:

- import `LockKeyhole` from `lucide-react`;
- remove `Droplets`, `Gauge`, `GlassWater`, `Shield`, `ShieldCheck`, `Sparkles`, `Sun`, and `Truck` from the icon import;
- add `import { aboutImage, services } from '../data/publicHomeContent'`;
- delete the page-local `services` array.

- [ ] **Step 4: Render the dedicated About image**

Replace the About visual contents with:

```jsx
<div className="about-visual">
  <img className="about-visual-image" src={aboutImage} alt="Hakum Auto Care precision vehicle detailing" />
  <span>Care in every detail</span>
  <strong>01</strong>
</div>
```

- [ ] **Step 5: Render photographic and locked service states**

Replace the Services card map with:

```jsx
<div className="service-grid">
  {services.map((service) => (
    <article className={`service-card ${service.available ? '' : 'is-locked'}`} key={service.title}>
      <div className="service-card-visual">
        {service.available ? (
          <img src={service.image} alt={service.imageAlt} loading="lazy" decoding="async" />
        ) : (
          <div className="service-card-locked" aria-hidden="true"><LockKeyhole /></div>
        )}
      </div>
      <div className="service-card-body">
        <h3>{service.title}</h3>
        <p>{service.copy}</p>
        {service.available && <Link to="/book">Book now <ArrowRight /></Link>}
      </div>
    </article>
  ))}
</div>
```

- [ ] **Step 6: Run the rendering contract test and scoped lint**

Run:

```bash
node --test tests/publicBranding.test.js
npx eslint src/pages/PublicLandingPage.jsx tests/publicBranding.test.js
```

Expected: both commands pass.

- [ ] **Step 7: Commit the renderer**

```bash
git add src/pages/PublicLandingPage.jsx tests/publicBranding.test.js
git commit -m "feat: render approved About and service imagery"
```

### Task 5: Match the approved About and Services layouts

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: DOM hooks created in Task 4.
- Produces: desktop 4-column, tablet 2-column, and phone 1-column Services layouts plus the split About panel.

- [ ] **Step 1: Write failing CSS contract assertions**

Add these assertions to `tests/publicBranding.test.js`:

```js
assert.match(css, /\.about-visual-image\s*\{[^}]*object-fit:cover/s)
assert.match(css, /\.about-copy \.about-lead\s*\{[^}]*font-style:italic/s)
assert.match(css, /\.service-grid\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/s)
assert.match(css, /\.service-card-visual\s*\{[^}]*aspect-ratio:4\/3/s)
assert.match(css, /\.service-card-visual img\s*\{[^}]*object-fit:cover/s)
assert.match(css, /\.service-card-locked\s*\{[^}]*background:#020a31/s)
assert.match(css, /@media\(max-width:1100px\)\{[^}]*\.service-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s)
assert.match(css, /@media\(max-width:600px\)\{[^}]*\.service-grid\{grid-template-columns:1fr/s)
```

- [ ] **Step 2: Run the test and verify the new hooks fail**

Run:

```bash
node --test tests/publicBranding.test.js
```

Expected: FAIL on `.about-visual-image`.

- [ ] **Step 3: Style the About image and emphasized lead**

Update the About rules so the image fills the existing visual column and the opening paragraph matches the reference emphasis:

```css
.about-visual { position:relative; min-height:600px; overflow:hidden; background:#020a31; }
.about-visual-image { width:100%; height:100%; position:absolute; inset:0; display:block; object-fit:cover; object-position:center; }
.about-visual:after { content:""; position:absolute; inset:0; border:1px solid rgba(241,241,241,.2); background:linear-gradient(180deg,rgba(2,10,49,.02),rgba(2,10,49,.28)); pointer-events:none; }
.about-visual>span,.about-visual>strong { z-index:1; }
.about-copy .about-lead { margin-bottom:30px; color:#222; font-size:clamp(20px,1.8vw,27px); font-weight:400; font-style:italic; line-height:1.3; }
```

- [ ] **Step 4: Style the editorial Services grid and locked tile**

Replace the temporary visual/overlay/icon rules with:

```css
.service-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-top:58px; }
.service-card { min-width:0; display:flex; flex-direction:column; overflow:hidden; background:#fff; color:#333; box-shadow:none; transition:transform .28s ease,box-shadow .28s ease; }
.service-card-visual { position:relative; width:100%; height:auto; aspect-ratio:4/3; overflow:hidden; background:#020a31; }
.service-card-visual img { width:100%; height:100%; display:block; object-fit:cover; object-position:center; transition:transform .35s ease; }
.service-card:hover .service-card-visual img { transform:scale(1.025); }
.service-card-locked { width:100%; height:100%; display:grid; place-items:center; color:#5fe9ee; background:#020a31; }
.service-card-locked svg { width:54px; height:54px; stroke-width:1.5; }
.service-card-body { min-height:205px; padding:22px 20px 20px; display:flex; flex-direction:column; }
.service-card.is-locked .service-card-body { min-height:205px; }
```

Keep the existing upright Benzin Semibold card headings, Gilmer Regular descriptions, and `Book now` row. Delete `.service-card-visual:before`, `.service-card:hover .service-card-visual:before`, `.service-card-visual>span`, and `.service-card-visual>svg`.

- [ ] **Step 5: Update responsive rules**

Use these exact grid transitions:

```css
@media(max-width:1100px){.service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.service-card h3{font-size:27px}}
@media(max-width:600px){.service-grid{grid-template-columns:1fr;gap:20px;margin-top:52px}.service-card-body{min-height:190px}.service-card h3{min-height:0;font-size:28px}}
```

Retain the existing stacked About rules at `800px` and below; remove background-position declarations that targeted the old hero-image background.

- [ ] **Step 6: Run tests, lint, and build**

Run:

```bash
node --test tests/publicBranding.test.js tests/publicHomeContent.test.js
npx eslint src/pages/PublicLandingPage.jsx src/data/publicHomeContent.js tests/publicBranding.test.js tests/publicHomeContent.test.js
npm run build
```

Expected: all commands pass. The existing large-chunk Vite warning is non-blocking.

- [ ] **Step 7: Commit layout styling**

```bash
git add src/styles.css tests/publicBranding.test.js
git commit -m "style: match approved About and Services layouts"
```

### Task 6: Final visual and regression verification

**Files:**
- Verify only; modify implementation files only if a check exposes a defect, then repeat the relevant task's test cycle.

**Interfaces:**
- Consumes: the completed homepage implementation.
- Produces: evidence that the local preview and production build are client-ready.

- [ ] **Step 1: Run all non-credential tests**

Run:

```bash
rg --files tests -g '*.test.js' | rg -v 'pushAuth\.test\.js$' | xargs node --test
```

Expected: 0 failures. `tests/pushAuth.test.js` remains excluded because it is the previously approved backend credential-only failure.

- [ ] **Step 2: Run final scoped lint and production build**

Run:

```bash
npx eslint src/pages/PublicLandingPage.jsx src/data/publicHomeContent.js tests/publicBranding.test.js tests/publicHomeContent.test.js
npm run build
git diff --check
```

Expected: all commands exit 0; the existing large-chunk warning may remain.

- [ ] **Step 3: Verify the live local page responds**

Run:

```bash
curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/
```

Expected: `200`.

- [ ] **Step 4: Review desktop and responsive layout**

At `http://127.0.0.1:5173/`, compare the page against the approved references:

- About Us shows `HKM-21` on the left and an emphasized italic opening paragraph on white.
- Services shows four columns and two rows on desktop.
- Seven filenames match their service cards.
- Mobile Detailing is dark blue with a cyan lock and no booking link.
- At tablet width the grid is two columns; at phone width it is one column.
- No image is stretched, clipped over text, or replaced by the hero image.

- [ ] **Step 5: Confirm repository state**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: clean worktree and separate commits for typography, assets, content mapping, rendering, and layout styling.
