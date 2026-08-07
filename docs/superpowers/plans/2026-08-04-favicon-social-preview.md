# Favicon and Social Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the improvised favicon and AI-generated social preview with deterministic outputs made from the official Hakum Drive brand assets.

**Architecture:** A small Node script uses Sharp at development time to trim, resize, pad, and composite the existing official PNG brand assets into browser, PWA, Apple, and Open Graph outputs. A Node test treats the built image files and `index.html`/manifest metadata as one public branding contract, so incorrect dimensions, missing assets, relative crawler URLs, or stale icon references fail before deployment.

**Tech Stack:** Node.js 24, Node test runner, Sharp, Vite, HTML Open Graph/Twitter metadata, Web App Manifest

## Global Constraints

- Use `public/branding/hakum-mark-blue.png` for the standalone mark.
- Use `public/branding/hakum-lw-ow.png` for the off-white combined logo and wordmark.
- Do not retain any part of the AI-generated wet-floor image.
- Use `https://auto-detailingand-carwash.vercel.app/og-image.png` as the absolute production social-image URL.
- Produce a 1200 × 630 PNG social preview with a solid `#020A31` navy background.
- Preserve the existing site title and description copy.

---

## File Structure

- `scripts/generate-brand-meta-assets.mjs`: deterministic image generation from the official Drive-derived source PNGs.
- `tests/brandMetaAssets.test.js`: observable contract for output files, dimensions, metadata, and manifest entries.
- `index.html`: favicon, Apple icon, Open Graph, and Twitter declarations.
- `public/manifest.webmanifest`: installable icon declarations with truthful sizes and purposes.
- `public/favicon.png`: generated 64 × 64 browser icon.
- `public/apple-touch-icon.png`: generated 180 × 180 Apple icon.
- `public/icon-192.png`: generated 192 × 192 PWA icon.
- `public/icon-512.png`: generated 512 × 512 PWA icon.
- `public/icon-maskable-512.png`: generated 512 × 512 maskable PWA icon with extra safe padding.
- `public/og-image.png`: generated 1200 × 630 Messenger/Open Graph image.
- `package.json` and `package-lock.json`: Sharp development dependency and asset-generation command.

### Task 1: Establish the failing public branding contract

**Files:**
- Create: `tests/brandMetaAssets.test.js`

**Interfaces:**
- Consumes: generated public files, `index.html`, and `public/manifest.webmanifest`.
- Produces: a single Node test suite that validates the browser/social branding contract.

- [ ] **Step 1: Write the failing test**

Create `tests/brandMetaAssets.test.js` with a dependency-free PNG header reader and assertions derived independently from the generator:

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

async function readPngSize(path) {
  const bytes = await readFile(projectFile(path))
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('Browser and social brand assets', () => {
  it('ships correctly sized official-mark icons', async () => {
    const expected = {
      'public/favicon.png': { width: 64, height: 64 },
      'public/apple-touch-icon.png': { width: 180, height: 180 },
      'public/icon-192.png': { width: 192, height: 192 },
      'public/icon-512.png': { width: 512, height: 512 },
      'public/icon-maskable-512.png': { width: 512, height: 512 },
    }

    for (const [path, dimensions] of Object.entries(expected)) {
      assert.deepEqual(await readPngSize(path), dimensions, path)
    }
  })

  it('ships a 1200 by 630 social card', async () => {
    assert.deepEqual(await readPngSize('public/og-image.png'), { width: 1200, height: 630 })
  })

  it('publishes crawler-safe social metadata and official favicon references', async () => {
    const html = await readFile(projectFile('index.html'), 'utf8')
    const imageUrl = 'https://auto-detailingand-carwash.vercel.app/og-image.png'

    assert.match(html, new RegExp(`<meta property="og:image" content="${imageUrl.replaceAll('.', '\\.')}"`))
    assert.match(html, /<meta property="og:image:type" content="image\/png"/)
    assert.match(html, /<meta property="og:image:width" content="1200"/)
    assert.match(html, /<meta property="og:image:height" content="630"/)
    assert.match(html, /<meta property="og:image:alt" content="Hakum Auto Care official logo"/)
    assert.match(html, new RegExp(`<meta name="twitter:image" content="${imageUrl.replaceAll('.', '\\.')}"`))
    assert.match(html, /<link rel="icon" href="\/favicon\.png" type="image\/png" sizes="64x64"/)
    assert.doesNotMatch(html, /favicon\.svg/)
  })

  it('declares truthful installable icon sizes', async () => {
    const manifest = JSON.parse(await readFile(projectFile('public/manifest.webmanifest'), 'utf8'))

    assert.deepEqual(manifest.icons, [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ])
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/brandMetaAssets.test.js
```

Expected: FAIL because `favicon.png` is currently 32 × 32, `og-image.png` is 1200 × 675, the PWA icon files do not exist, and social metadata uses a relative URL.

- [ ] **Step 3: Commit the failing contract**

```bash
git add tests/brandMetaAssets.test.js
git commit -m "test: define favicon and social preview contract"
```

### Task 2: Generate official icon and social-card assets

**Files:**
- Create: `scripts/generate-brand-meta-assets.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Replace: `public/favicon.png`
- Replace: `public/apple-touch-icon.png`
- Replace: `public/og-image.png`
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`
- Create: `public/icon-maskable-512.png`

**Interfaces:**
- Consumes: `public/branding/hakum-mark-blue.png` and `public/branding/hakum-lw-ow.png`.
- Produces: `npm run generate:brand-meta`, which writes all browser, PWA, Apple, and social PNGs.

- [ ] **Step 1: Install the development-only image dependency**

Run:

```bash
npm install --save-dev sharp
```

Expected: `sharp` appears under `devDependencies`; the lockfile records the exact install.

- [ ] **Step 2: Add the generation command**

Add this script to `package.json`:

```json
"generate:brand-meta": "node scripts/generate-brand-meta-assets.mjs"
```

- [ ] **Step 3: Implement deterministic image generation**

Create `scripts/generate-brand-meta-assets.mjs`:

```js
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const publicDir = new URL('../public/', import.meta.url)
const markPath = new URL('branding/hakum-mark-blue.png', publicDir)
const lockupPath = new URL('branding/hakum-lw-ow.png', publicDir)
const OFF_WHITE = { r: 247, g: 247, b: 242, alpha: 1 }
const NAVY = { r: 2, g: 10, b: 49, alpha: 1 }

await mkdir(publicDir, { recursive: true })

async function squareIcon(filename, size, markRatio) {
  const markSize = Math.round(size * markRatio)
  const mark = await sharp(markPath)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(markSize, markSize, { fit: 'contain' })
    .png()
    .toBuffer()

  await sharp({ create: { width: size, height: size, channels: 4, background: OFF_WHITE } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(new URL(filename, publicDir))
}

await Promise.all([
  squareIcon('favicon.png', 64, 0.78),
  squareIcon('apple-touch-icon.png', 180, 0.72),
  squareIcon('icon-192.png', 192, 0.72),
  squareIcon('icon-512.png', 512, 0.72),
  squareIcon('icon-maskable-512.png', 512, 0.56),
])

const lockup = await sharp(lockupPath)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize(900, 360, { fit: 'inside', withoutEnlargement: true })
  .png()
  .toBuffer()

await sharp({ create: { width: 1200, height: 630, channels: 4, background: NAVY } })
  .composite([{ input: lockup, gravity: 'centre' }])
  .png({ compressionLevel: 9 })
  .toFile(new URL('og-image.png', publicDir))
```

- [ ] **Step 4: Generate all assets**

Run:

```bash
npm run generate:brand-meta
```

Expected: six PNG outputs are written without errors.

- [ ] **Step 5: Re-run the focused test and confirm only metadata assertions remain RED**

Run:

```bash
node --test tests/brandMetaAssets.test.js
```

Expected: icon and social-card dimension tests PASS; metadata and manifest tests still FAIL.

- [ ] **Step 6: Inspect generated graphics**

Open `public/favicon.png`, `public/apple-touch-icon.png`, and `public/og-image.png`. Confirm the official geometry is unchanged, the mark has breathing room, the maskable icon has extra padding, and the social lockup is centered without clipping.

- [ ] **Step 7: Commit generated assets and generator**

```bash
git add package.json package-lock.json scripts/generate-brand-meta-assets.mjs public/favicon.png public/apple-touch-icon.png public/icon-192.png public/icon-512.png public/icon-maskable-512.png public/og-image.png
git commit -m "feat: generate official Hakum brand meta assets"
```

### Task 3: Publish crawler-safe metadata and manifest entries

**Files:**
- Modify: `index.html`
- Modify: `public/manifest.webmanifest`

**Interfaces:**
- Consumes: the generated files from Task 2.
- Produces: browser, PWA, Messenger, Open Graph, and Twitter references to the correct official files.

- [ ] **Step 1: Update Open Graph and Twitter metadata**

Replace the current relative social-image tags in `index.html` with:

```html
<meta property="og:image" content="https://auto-detailingand-carwash.vercel.app/og-image.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Hakum Auto Care official logo" />
```

Use the same absolute URL for `twitter:image` and add:

```html
<meta name="twitter:image:alt" content="Hakum Auto Care official logo" />
```

- [ ] **Step 2: Replace active favicon references**

Remove the `favicon.svg` link and use:

```html
<link rel="icon" href="/favicon.png" type="image/png" sizes="64x64" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
```

- [ ] **Step 3: Correct the web app manifest**

Replace `manifest.icons` with:

```json
[
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/brandMetaAssets.test.js
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the metadata update**

```bash
git add index.html public/manifest.webmanifest
git commit -m "feat: publish official favicon and social preview"
```

### Task 4: Complete regression and build verification

**Files:**
- Verify only; no planned production edits.

**Interfaces:**
- Consumes: completed generated assets and metadata.
- Produces: fresh evidence that the site is safe to deploy.

- [ ] **Step 1: Run branding tests**

Run:

```bash
node --test tests/brandMetaAssets.test.js tests/publicBranding.test.js tests/installApp.test.js
```

Expected: all tests pass with 0 failures.

- [ ] **Step 2: Run the complete Node test suite**

Run:

```bash
node --test tests/*.test.js
```

Expected: 0 failures. If an environment-dependent pre-existing test fails, record its exact name and output instead of claiming a clean suite.

- [ ] **Step 3: Run lint and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 4: Inspect the production output contract**

Run:

```bash
test -f dist/favicon.png
test -f dist/apple-touch-icon.png
test -f dist/icon-192.png
test -f dist/icon-512.png
test -f dist/icon-maskable-512.png
test -f dist/og-image.png
rg -n "https://auto-detailingand-carwash\.vercel\.app/og-image\.png|favicon\.png|apple-touch-icon\.png" dist/index.html
```

Expected: every file check succeeds and built HTML contains the absolute social-image URL and official icon references.

- [ ] **Step 5: Review the final diff and working tree**

Run:

```bash
git diff --check
git status --short --branch
git log -4 --oneline
```

Expected: no whitespace errors; only any explicitly uncommitted verification artifact is shown.

- [ ] **Step 6: Document the Messenger cache follow-up**

After the change is deployed, submit `https://auto-detailingand-carwash.vercel.app/` to Facebook Sharing Debugger and choose **Scrape Again**. This is an external cache refresh, not a code change.

