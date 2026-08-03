# Public Brand Typography and Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply self-hosted Benzin and Gilmer typography plus the approved white Hakum logo to the public website without changing internal product interfaces.

**Architecture:** Keep brand assets under `public/branding` and `public/fonts`, define weight-specific font faces and public typography tokens in `src/design-tokens.css`, and scope all body typography through `.public-site` in `src/styles.css`. Replace only the two public `PublicLayout` wordmarks with the supplied PNG; authentication and internal layouts retain their existing branding.

**Tech Stack:** React 19, Vite 6, CSS custom properties and `@font-face`, Node's built-in test runner, ESLint.

## Global Constraints

- Apply the change only to pages rendered inside `PublicLayout` and their shared public components.
- Do not restyle admin, operations, authentication, customer-account, CRM, finance, planning, POS, or other internal surfaces.
- Preserve the current public structure, copy, routes, interactions, colors, imagery, animations, and responsive behavior.
- Use the exact Google Drive asset `Hakum LW (OW).png` without recoloring, cropping, stretching, or recreating it.
- Self-host all font and logo assets; do not add a third-party font service.
- Use `font-display: swap`, generic fallbacks, reserved logo dimensions, and the existing accessible link label.
- Do not modify the synced project `sources/` directory.

## File Structure

- Create `tests/publicBranding.test.js`: static regression contract for public font assets, font declarations, scope, and public header/footer logo markup.
- Create `public/fonts/benzin-medium.woff2`, `public/fonts/benzin-semibold.woff2`, and `public/fonts/benzin-extrabold.woff2`: converted deployment fonts for public display roles.
- Create `public/fonts/gilmer-light.woff2`, `public/fonts/gilmer-regular.woff2`, `public/fonts/gilmer-medium.woff2`, and `public/fonts/gilmer-bold.woff2`: supplied deployment fonts for public supporting roles.
- Create `public/branding/hakum-lw-ow.png`: exact copy of the approved Drive logo.
- Modify `src/design-tokens.css`: weight-specific font faces and public typography variables.
- Modify `src/styles.css`: public-only family and weight mapping plus responsive logo dimensions.
- Modify `src/layouts/PublicLayout.jsx`: image logo in header and footer.

---

### Task 1: Lock the public branding contract

**Files:**
- Create: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: repository file paths and source text.
- Produces: a regression contract named `Public branding assets and scope` that later tasks must satisfy.

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

describe('Public branding assets and scope', () => {
  it('ships the approved logo and required web fonts', async () => {
    const assets = [
      'public/branding/hakum-lw-ow.png',
      'public/fonts/benzin-medium.woff2',
      'public/fonts/benzin-semibold.woff2',
      'public/fonts/benzin-extrabold.woff2',
      'public/fonts/gilmer-light.woff2',
      'public/fonts/gilmer-regular.woff2',
      'public/fonts/gilmer-medium.woff2',
      'public/fonts/gilmer-bold.woff2',
    ]
    await Promise.all(assets.map((path) => access(projectFile(path))))
  })

  it('declares Benzin display weights and Gilmer supporting weights', async () => {
    const css = await readFile(projectFile('src/design-tokens.css'), 'utf8')
    assert.match(css, /font-family:\s*"Benzin"/)
    assert.match(css, /benzin-extrabold\.woff2/)
    assert.match(css, /font-family:\s*"Gilmer"/)
    assert.match(css, /gilmer-bold\.woff2/)
    assert.match(css, /--font-public-display:\s*"Benzin"/)
    assert.match(css, /--font-public-body:\s*"Gilmer"/)
  })

  it('scopes the brand families to the public wrapper', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')
    assert.match(css, /\.public-site\s*\{[^}]*font-family:var\(--font-public-body\)/s)
    assert.match(css, /\.public-site\s+:is\([^}]*font-family:var\(--font-public-display\)/s)
  })

  it('uses the approved logo in both public wordmarks only', async () => {
    const layout = await readFile(projectFile('src/layouts/PublicLayout.jsx'), 'utf8')
    assert.equal((layout.match(/src="\/branding\/hakum-lw-ow\.png"/g) || []).length, 2)
    assert.equal((layout.match(/className="wordmark-image"/g) || []).length, 2)
    assert.doesNotMatch(layout, /<b>H<\/b>/)
    assert.match(layout, /aria-label="Hakum Auto Care home"/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/publicBranding.test.js`

Expected: FAIL because `public/branding/hakum-lw-ow.png` and the public font files do not exist.

- [ ] **Step 3: Commit the failing contract**

```bash
git add tests/publicBranding.test.js
git commit -m "test: define public branding contract"
```

---

### Task 2: Add self-hosted brand assets and font declarations

**Files:**
- Create: `public/fonts/benzin-medium.woff2`
- Create: `public/fonts/benzin-semibold.woff2`
- Create: `public/fonts/benzin-extrabold.woff2`
- Create: `public/fonts/gilmer-light.woff2`
- Create: `public/fonts/gilmer-regular.woff2`
- Create: `public/fonts/gilmer-medium.woff2`
- Create: `public/fonts/gilmer-bold.woff2`
- Create: `public/branding/hakum-lw-ow.png`
- Modify: `src/design-tokens.css`

**Interfaces:**
- Consumes: supplied local font folders and Google Drive file ID `1FKRGvt7E_vUjkdsFzDdU5jug9bfFIiI8`.
- Produces: `--font-public-display`, `--font-public-body`, and weight-specific browser-loadable font faces.

- [ ] **Step 1: Materialize the approved assets**

Create the asset directories and copy the supplied Gilmer files:

```bash
mkdir -p public/fonts public/branding
cp "/Users/kiro/Downloads/Gilmer_Font/Gilmer Light.woff2" public/fonts/gilmer-light.woff2
cp "/Users/kiro/Downloads/Gilmer_Font/Gilmer Regular.woff2" public/fonts/gilmer-regular.woff2
cp "/Users/kiro/Downloads/Gilmer_Font/Gilmer Medium.woff2" public/fonts/gilmer-medium.woff2
cp "/Users/kiro/Downloads/Gilmer_Font/Gilmer Bold.woff2" public/fonts/gilmer-bold.woff2
```

Fetch Google Drive file ID `1FKRGvt7E_vUjkdsFzDdU5jug9bfFIiI8` through the connected Drive action with raw-file download enabled, then materialize its returned authenticated file reference at `public/branding/hakum-lw-ow.png`. Verify that the saved file is a `5000 × 5000` RGBA PNG.

Convert Benzin Medium, Semibold, and ExtraBold TTF sources to WOFF2 using a temporary FontTools installation. Preserve the full character set and do not add FontTools to project dependencies.

```bash
brand_tools_dir=$(mktemp -d)
python3 -m pip install --quiet --target "$brand_tools_dir" fonttools brotli
PYTHONPATH="$brand_tools_dir" python3 -m fontTools.subset /Users/kiro/Downloads/Benzin-Font/benzin-medium.ttf --output-file=public/fonts/benzin-medium.woff2 --flavor=woff2 --unicodes='*' --layout-features='*'
PYTHONPATH="$brand_tools_dir" python3 -m fontTools.subset /Users/kiro/Downloads/Benzin-Font/benzin-semibold.ttf --output-file=public/fonts/benzin-semibold.woff2 --flavor=woff2 --unicodes='*' --layout-features='*'
PYTHONPATH="$brand_tools_dir" python3 -m fontTools.subset /Users/kiro/Downloads/Benzin-Font/benzin-extrabold.ttf --output-file=public/fonts/benzin-extrabold.woff2 --flavor=woff2 --unicodes='*' --layout-features='*'
```

- [ ] **Step 2: Replace the optional local-only font declarations**

In `src/design-tokens.css`, declare `Benzin` at weights 500, 600, and 800 from the three `/fonts/benzin-*.woff2` files. Declare `Gilmer` at weights 300, 400, 500, and 700 from the four `/fonts/gilmer-*.woff2` files. Every face uses `font-style: normal` and `font-display: swap`.

Set these tokens:

```css
--font-public-display: "Benzin", "Arial Black", sans-serif;
--font-public-body: "Gilmer", Arial, sans-serif;
```

Leave the existing global `--font-display` and `--font-body` tokens unchanged. Reassigning them would leak the new fonts into internal components that also consume those tokens.

- [ ] **Step 3: Run the focused test and confirm the remaining failure**

Run: `node --test tests/publicBranding.test.js`

Expected: asset and declaration tests PASS; scope and layout tests still FAIL because public CSS and `PublicLayout` have not changed.

- [ ] **Step 4: Commit the asset foundation**

```bash
git add public/fonts public/branding src/design-tokens.css
git commit -m "feat: add self-hosted Hakum brand assets"
```

---

### Task 3: Apply typography and logo to public pages

**Files:**
- Modify: `src/styles.css`
- Modify: `src/layouts/PublicLayout.jsx`
- Test: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: `--font-public-display`, `--font-public-body`, `/branding/hakum-lw-ow.png`, and the existing `.public-site` wrapper.
- Produces: public-only typography mapping and responsive `.wordmark-image` rendering.

- [ ] **Step 1: Scope the font mapping in `src/styles.css`**

Set `.public-site` to `font-family: var(--font-public-body)` and regular weight. Add public-only mappings:

```css
.public-site :is(.display-title, .inner-hero h1, .utility-hero h1) {
  font-family: var(--font-public-display);
  font-weight: 800;
}

.public-site :is(.section-title, .hero-experience h2, .ui-stat-card > strong, .service-card h3, .coating-card h3, .home-branch-grid h3, .footer-pitch h2, .numbered-grid h2, .package-card h2, .branch-grid h2) {
  font-family: var(--font-public-display);
  font-weight: 600;
}

.public-site :is(.desktop-nav, .mobile-nav, .header-actions, .hero-actions, .button, .ui-button, label) {
  font-family: var(--font-public-body);
  font-weight: 700;
}

.public-site :is(.eyebrow, .hero-location, .footer-kicker, .footer-details h3, .footer-navigation) {
  font-family: var(--font-public-body);
  font-weight: 500;
}
```

Keep paragraphs, inputs, selects, textareas, addresses, legal copy, and footer copy inherited from Gilmer Regular. Apply weight 300 only to existing helper/secondary-description selectors where a lighter treatment remains readable.

- [ ] **Step 2: Replace both generated public wordmarks**

In `src/layouts/PublicLayout.jsx`, replace each generated `<b>` and `<span>` wordmark body with:

```jsx
<img
  className="wordmark-image"
  src="/branding/hakum-lw-ow.png"
  alt=""
  width="5000"
  height="5000"
/>
```

Keep the header link's existing `aria-label="Hakum Auto Care home"` and add the same label to the footer link.

- [ ] **Step 3: Size the responsive logo**

The supplied PNG has intentional transparent safe space around the complete logo. Replace obsolete `.wordmark b`, `.wordmark span`, and `.wordmark small` rules with a fixed viewport that magnifies the intact image without clipping visible logo pixels:

```css
.wordmark {
  display: block;
  width: 124px;
  height: 70px;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
}

.wordmark-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(1.4);
}

.footer-logo {
  width: 170px;
  height: 96px;
}
```

At `max-width: 500px`, use a `112px × 64px` header viewport. Preserve the source aspect ratio with `object-fit: contain`; the image scale only removes transparent safe-space from the rendered viewport and does not crop visible logo artwork.

- [ ] **Step 4: Run the focused test to verify green**

Run: `node --test tests/publicBranding.test.js`

Expected: PASS with four passing subtests.

- [ ] **Step 5: Commit the public integration**

```bash
git add src/styles.css src/layouts/PublicLayout.jsx tests/publicBranding.test.js
git commit -m "feat: apply Hakum branding to public website"
```

---

### Task 4: Verify behavior, isolation, and responsive rendering

**Files:**
- Modify only if verification exposes a scoped public regression.

**Interfaces:**
- Consumes: completed public branding implementation.
- Produces: fresh automated and visual evidence for every acceptance criterion.

- [ ] **Step 1: Run all automated checks**

Run:

```bash
node --test tests/*.test.js
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, ESLint exits 0, Vite production build exits 0, and `git diff --check` prints no errors.

- [ ] **Step 2: Verify desktop public rendering**

Start the Vite development server and inspect `/` at desktop width. Confirm the white image logo is visible without stretching; hero and major public titles use Benzin; navigation, buttons, labels, and body copy use the intended Gilmer weights; headline wrapping, actions, and footer remain aligned.

- [ ] **Step 3: Verify mobile public rendering**

Inspect `/` at 390 × 844. Confirm the header logo fits beside the menu control, the hero does not clip, major headings wrap cleanly, supporting copy is readable, and the footer logo/layout stays within the viewport.

- [ ] **Step 4: Verify secondary-page consistency and internal isolation**

Inspect `/services` and one internal route such as `/login`. Confirm the secondary public page inherits the Benzin/Gilmer system and that the internal route retains its existing typography and generated authentication mark.

- [ ] **Step 5: Retry the live reference and record the result**

Open `https://www.hakumautocare.com` and compare its visible type roles with the implementation. If its security check remains unavailable, record that limitation and use the supplied revision image as the visual source of truth.

- [ ] **Step 6: Review repository state**

Run: `git status --short --branch && git log -5 --oneline`

Expected: only intentional implementation-plan progress remains, and local `main` is ahead of `origin/main` by the documented commits.
