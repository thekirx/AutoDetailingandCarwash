# PPF Stage and Package Ladder Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the marketplace-overlaid PPF photo with a clean wide truck image and rebuild the homepage PPF packages as the approved responsive protection ladder.

**Architecture:** Keep `PPF_PACKAGES` as the production source of truth and map it into a concise homepage-only view model that retains booking state. Replace only the PPF homepage presentation and its scoped CSS; backend integrations and other routes remain unchanged.

**Tech Stack:** React 19, React Router, Vite, CSS media queries, Node test runner, built-in image editing.

## Global Constraints

- Frontend-only: no Supabase, API, schema, permission, authentication, booking, queue, PWA, or internal-route changes.
- Preserve package-specific `/book` state for Basic, Premium, and Platinum.
- Use the supplied grey pickup as the image-edit target and remove every marketplace overlay without inventing text or logos.
- Support desktop, tablet, and mobile without horizontal overflow.
- Do not reuse the legacy package-card structure, car outline, tag wall, long lists, or add-on disclosure.

---

### Task 1: Clean PPF Information Image

**Files:**
- Create: `src/assets/services/ppf-information-grey-truck-clean.jpg`
- Modify: `src/data/publicHomeContent.js:17-20`
- Test: `tests/publicHomeContent.test.js`

**Interfaces:**
- Consumes: user-supplied PNG at `/var/folders/mm/q3tgv861039btwc5c9blk9mh0000gn/T/codex-clipboard-60e00ed4-67cc-4d40-b6e2-beb1f16df4cc.png`.
- Produces: `ppfInformation.image` referencing the cleaned asset and descriptive `ppfInformation.imageAlt`.

- [ ] **Step 1: Update the asset test to require the new filename**

```js
assert.equal(
  new URL(ppfInformation.image).pathname.split('/').at(-1),
  'ppf-information-grey-truck-clean.jpg',
)
assert.equal(ppfInformation.imageAlt, 'Grey pickup truck prepared for paint protection film')
```

- [ ] **Step 2: Run the asset test and verify it fails**

Run: `node --test tests/publicHomeContent.test.js`
Expected: FAIL because `ppfInformation` still references `ppf-information-blue-truck.jpg`.

- [ ] **Step 3: Edit and validate the photograph**

Use the built-in image editor with the supplied image as the edit target. Remove the `NEW` ribbon, bottom serial text, camera badge, and all marketplace overlays; naturally reconstruct the covered workshop, pavement, and vehicle edges; preserve the truck and photographic realism; create a wide text-free composition. Inspect the result, then optimize it to `src/assets/services/ppf-information-grey-truck-clean.jpg` for web delivery.

- [ ] **Step 4: Point the PPF information model at the cleaned asset**

```js
export const ppfInformation = {
  image: new URL('../assets/services/ppf-information-grey-truck-clean.jpg', import.meta.url).href,
  imageAlt: 'Grey pickup truck prepared for paint protection film',
  // existing title, copy, and feature data stay unchanged
}
```

- [ ] **Step 5: Run the asset test and verify it passes**

Run: `node --test tests/publicHomeContent.test.js`
Expected: all tests pass and the asset is readable.

### Task 2: Replace Package Cards with Protection Ladder

**Files:**
- Modify: `src/lib/homepageContent.js:6-31`
- Modify: `src/components/public/home/PpfPackagesSection.jsx`
- Test: `tests/homepageContent.test.js`
- Test: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: `buildPpfPackageCards(PPF_PACKAGES)` and existing `bookingState` fields.
- Produces: concise cards containing `id`, `number`, `title`, `description`, `coverageType`, `thickness`, `warrantySummary`, `recommendedLabel`, `ctaLabel`, and `bookingState`.

- [ ] **Step 1: Write failing tests for concise package output and new structure**

```js
assert.deepEqual(Object.keys(cards[0]).sort(), [
  'bookingState', 'coverageType', 'ctaLabel', 'description', 'id', 'number',
  'recommendedLabel', 'thickness', 'title', 'warrantySummary',
].sort())
assert.equal(cards[1].bookingState.packageId, 'premium')
assert.match(source, /ppf-protection-ladder/)
assert.doesNotMatch(source, /ppf-static-lists|ppf-static-addons|ppf-static-tags/)
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `node --test tests/homepageContent.test.js tests/publicBranding.test.js`
Expected: FAIL because verbose view-model keys and legacy card markup remain.

- [ ] **Step 3: Simplify the homepage package view model**

Return only the fields listed in the interface. Derive `warrantySummary` from `item.warranty[0] || ''`. Preserve every existing `bookingState` property exactly.

- [ ] **Step 4: Implement the approved ladder markup**

Render a `ppf-package-ladder-layout` containing a blue `ppf-package-ladder-intro` and a semantic `ol.ppf-protection-ladder`. Each `li` renders sequence number, package name, description, coverage/thickness metadata, warranty/recommendation, and a `/book` link with `state={card.bookingState}`. Remove all legacy package-card markup.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `node --test tests/homepageContent.test.js tests/publicBranding.test.js`
Expected: all tests pass.

### Task 3: Responsive Styling, Verification, and Publication

**Files:**
- Modify: `src/styles.css:5487-5624`
- Test: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: ladder class names from Task 2.
- Produces: overflow-safe desktop, tablet, and mobile layouts with visible focus and 44px-or-taller booking actions.

- [ ] **Step 1: Extend the responsive source test**

```js
assert.match(styles, /\.ppf-package-ladder-layout/)
assert.match(styles, /\.ppf-protection-ladder/)
assert.match(styles, /@media\(max-width:900px\)/)
assert.match(styles, /@media\(max-width:600px\)/)
```

- [ ] **Step 2: Run the branding test and verify it fails**

Run: `node --test tests/publicBranding.test.js`
Expected: FAIL because the ladder styles do not exist.

- [ ] **Step 3: Replace legacy PPF package CSS**

Add the approved two-region desktop grid, stacked tablet layout, and vertical mobile rows. Use `minmax(0, 1fr)`, wrapping text, `overflow: hidden` only at the section boundary, and full-width mobile booking links with `min-height: 48px`. Add `:focus-visible` styling and preserve `data-motion` compatibility without requiring animation.

- [ ] **Step 4: Run focused tests, lint, and production build**

Run:

```bash
node --test tests/homepageContent.test.js tests/publicBranding.test.js tests/publicHomeContent.test.js
npx eslint src/data/publicHomeContent.js src/lib/homepageContent.js src/components/public/home/PpfPackagesSection.jsx tests/homepageContent.test.js tests/publicBranding.test.js tests/publicHomeContent.test.js
npm run build
```

Expected: all focused tests pass, ESLint exits 0, and Vite produces the cleaned asset in `dist/assets`.

- [ ] **Step 5: Inspect the final diff and commit**

```bash
git diff --check
git status -sb
git add src/assets/services/ppf-information-grey-truck-clean.jpg src/data/publicHomeContent.js src/lib/homepageContent.js src/components/public/home/PpfPackagesSection.jsx src/styles.css tests/homepageContent.test.js tests/publicBranding.test.js tests/publicHomeContent.test.js
git commit -m "Redesign PPF package ladder"
```

- [ ] **Step 6: Push the feature branch and confirm the draft PR updates**

```bash
git push origin codex/preferred-homepage-transplant
gh pr view 5 --json url,isDraft,state,headRefName,baseRefName
```

Expected: remote branch matches local HEAD and draft PR #5 remains open against `main`.
