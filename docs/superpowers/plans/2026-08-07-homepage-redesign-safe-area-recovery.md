# Homepage Redesign and iPhone Safe-Area Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the homepage tree from commit `65f4003` while retaining and verifying iPhone Home Screen full-screen safe-area support.

**Architecture:** Integrate `origin/main` into the existing redesign branch with a normal merge, preserving the redesign during conflict resolution. Lock the iPhone behavior with source-level metadata and CSS regression tests, then merge the verified PR into `main` so Vercel receives the combined tree.

**Tech Stack:** Git, React, Vite, CSS safe-area environment variables, Web App Manifest, Node test runner, ESLint

## Global Constraints

- Do not force-push or reset shared history.
- Preserve the homepage design represented by commit `65f4003`.
- Retain `viewport-fit=cover`, Apple standalone metadata, and top safe-area padding.
- Do not change unrelated homepage sections or application behavior.
- Keep the optimized service WebP assets tracked.

---

### Task 1: Integrate the Redesign and Main Histories

**Files:**
- Modify through merge: `index.html`
- Modify through merge: `src/styles.css`
- Preserve: `src/pages/PublicLandingPage.jsx`
- Preserve: `src/data/publicHomeContent.js`
- Preserve: `src/assets/services/*.webp`

**Interfaces:**
- Consumes: commit `65f4003` and `origin/main` at `283bc6a`
- Produces: one merge tree containing both histories without force-pushing

- [ ] **Step 1: Record the pre-merge tree and expected commits**

Run:

```bash
git status -sb
git rev-parse HEAD
git rev-parse origin/main
```

Expected: clean feature branch at or descended from `65f4003`; `origin/main` resolves to `283bc6a` or a reviewed successor.

- [ ] **Step 2: Merge the latest main branch**

Run:

```bash
git merge --no-ff origin/main
```

Expected: a clean merge or conflicts limited to files modified by both branches.

- [ ] **Step 3: Resolve overlaps by preserving the redesign plus safe-area additions**

Required final HTML viewport value:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Required final header behavior:

```css
.public-header {
  padding-top: env(safe-area-inset-top, 0px);
}
```

Keep the rest of the redesigned `src/styles.css` and homepage files unchanged.

- [ ] **Step 4: Confirm both histories and the redesigned assets are present**

Run:

```bash
git merge-base --is-ancestor 65f4003 HEAD
git merge-base --is-ancestor 283bc6a HEAD
git status --short src/assets/services
```

Expected: both ancestry checks exit `0`; no optimized WebP is deleted or untracked.

### Task 2: Lock the iPhone Full-Screen Contract

**Files:**
- Modify: `tests/brandMetaAssets.test.js`
- Modify: `tests/publicBranding.test.js`
- Modify: `index.html`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: public HTML metadata, `public/manifest.webmanifest`, and `.public-header` CSS
- Produces: regression coverage for an installed iPhone Home Screen app extending behind the status area safely

- [ ] **Step 1: Write failing metadata and safe-area tests**

Add to `tests/brandMetaAssets.test.js`:

```js
it('supports iPhone Home Screen fullscreen safe areas', async () => {
  const html = await readFile(projectFile('index.html'), 'utf8')
  const manifest = JSON.parse(await readFile(projectFile('public/manifest.webmanifest'), 'utf8'))

  assert.match(html, /content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/)
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/)
  assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/)
  assert.equal(manifest.display, 'standalone')
})
```

Add to `tests/publicBranding.test.js`:

```js
assert.match(css, /\.public-header\s*\{[^}]*padding-top:\s*env\(safe-area-inset-top,\s*0px\)/s)
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test tests/brandMetaAssets.test.js tests/publicBranding.test.js
```

Expected: FAIL until the merged safe-area declarations use the complete final contract.

- [ ] **Step 3: Apply the minimal safe-area implementation**

Ensure `index.html` contains `viewport-fit=cover` and the existing Apple standalone metadata. Ensure `.public-header` uses `padding-top:env(safe-area-inset-top,0px)` while retaining its redesigned gradient, blur, border, positioning, and transitions.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
node --test tests/brandMetaAssets.test.js tests/publicBranding.test.js
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the full-screen contract**

Run:

```bash
git add index.html src/styles.css tests/brandMetaAssets.test.js tests/publicBranding.test.js
git commit -m "Verify iPhone fullscreen safe area"
```

### Task 3: Verify and Publish the Combined Homepage

**Files:**
- Verify: `src/pages/PublicLandingPage.jsx`
- Verify: `src/styles.css`
- Verify: `src/assets/services/*.webp`

**Interfaces:**
- Consumes: the integrated feature branch
- Produces: pushed feature branch and merged `main` deployment source

- [ ] **Step 1: Run project verification**

Run:

```bash
rg --files tests -g '*.test.js' -g '!pushAuth.test.js' | xargs node --test
npx eslint src/pages/PublicLandingPage.jsx src/data/publicHomeContent.js tests/brandMetaAssets.test.js tests/publicBranding.test.js
npm run build
git diff --check
```

Expected: all commands exit `0`; existing bundle-size notices may remain informational.

- [ ] **Step 2: Verify responsive rendering**

Render the homepage at desktop and iPhone-sized viewports. Confirm the redesigned Services and Ceramic Packages sections remain intact, the public header covers the simulated top safe area, there are no application error overlays, and there are no new console errors.

- [ ] **Step 3: Push the feature branch**

Run:

```bash
git push -u origin agent/homepage-services-redesign
```

Expected: the remote feature branch advances to the verified combined commit.

- [ ] **Step 4: Merge PR #4 into main**

Run:

```bash
gh pr ready 4
gh pr merge 4 --merge
```

Expected: PR #4 reports `MERGED` and `main` contains both the redesign and iPhone safe-area commits.

- [ ] **Step 5: Verify remote deployment source**

Run:

```bash
gh pr view 4 --json state,mergedAt,mergeCommit,url
gh api repos/thekirx/AutoDetailingandCarwash/branches/main --jq '.commit.sha'
git status -sb
```

Expected: PR state is `MERGED`, the remote `main` head is the merge commit, and the local worktree is clean.
