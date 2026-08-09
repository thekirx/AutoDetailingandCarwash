# Preferred Flow Visual Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the approved homepage visuals, create a reference-led PPF information section, remove Classic ceramic coating, and add Dasmariñas Coming Soon.

**Architecture:** Keep the current homepage composition and static content source. Add a dedicated PPF information component inside the existing home service module, centralize branch-card view data in a small pure helper, and use scoped responsive CSS for each correction.

**Tech Stack:** React 19, Vite, CSS, Node test runner, Browser plugin.

## Global Constraints

- Preserve current Hakum assets, typography, color system, section order, PPF package visualizer, form behavior, header, and footer.
- Do not add unverified market-leader or warranty-duration claims.
- Dasmariñas is a non-clickable coming-soon location and is excluded from the active branch count.
- Add GSAP-ready hooks only; do not add final animation behavior.
- Verify both desktop and mobile without horizontal overflow.

---

### Task 1: Static Homepage Content Contracts

**Files:**
- Modify: `src/data/publicHomeContent.js`
- Modify: `tests/publicContent.test.js`

**Interfaces:**
- Produces: two-item `ceramicPackages`; `ppfInformation.features` with `title` and `copy`.
- Consumes: existing Hakum PPF and ceramic assets.

- [ ] **Step 1: Add failing assertions**

Assert ceramic package titles equal `['PREMIUM', 'PLATINUM']`, PPF headline equals `Protection engineered for every drive.`, and feature titles equal `['Clarity', 'Stretch', 'Adhesion', 'Warranty']`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/publicContent.test.js`

Expected: failure because Classic remains and PPF features are not defined.

- [ ] **Step 3: Update static content**

Remove the Classic object and add neutral PPF feature copy. Keep existing Premium and Platinum assets and order.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/publicContent.test.js`

Expected: all public-content tests pass.

### Task 2: PPF Feature Layout and Overflow Corrections

**Files:**
- Modify: `src/components/public/home/HomeServiceSections.jsx`
- Modify: `src/styles.css`
- Test: `tests/publicBranding.test.js`

**Interfaces:**
- Consumes: `ppfInformation.features` and current `ppfInformation.image`.
- Produces: accessible `PpfInformationSection` with `data-motion-section="ppf-information"`.

- [ ] **Step 1: Add failing structure assertions**

Assert the service module contains `ppf-information-stage`, maps `ppfInformation.features`, and preserves the existing PPF motion-section identifier.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/publicBranding.test.js`

Expected: failure because the current PPF section uses the generic split feature.

- [ ] **Step 3: Build the dedicated PPF section**

Render the safe heading, four feature articles, existing image, decorative film overlay, and hidden connector lines. Keep the PPF package section separate.

- [ ] **Step 4: Correct responsive type**

Constrain `.home-split-copy` and the Nano Tint heading with `min-width:0`, overflow control, and a smaller container-aware size. Constrain partnership heading width and size so it never crosses the grid column.

- [ ] **Step 5: Verify GREEN and lint**

Run: `node --test tests/publicBranding.test.js && npx eslint src/components/public/home/HomeServiceSections.jsx`

Expected: tests and lint pass.

### Task 3: Branch Presentation

**Files:**
- Create: `src/lib/homeBranches.js`
- Modify: `src/components/public/home/HomeEndingSections.jsx`
- Modify: `src/styles.css`
- Create: `tests/homeBranches.test.js`

**Interfaces:**
- Produces: `buildHomeBranchCards(branches)` returning active link cards followed by `{ name:'Dasmariñas', address:'Dasmariñas, Cavite', status:'Coming Soon', isComingSoon:true }`.
- Consumes: branch objects with `slug`, `name`, and `address`.

- [ ] **Step 1: Write failing helper tests**

Assert live branches remain active, fallbacks are Bacoor/Batangas when data is empty, Dasmariñas is always last, and the active count excludes Dasmariñas.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/homeBranches.test.js`

Expected: module-not-found failure.

- [ ] **Step 3: Implement and render branch cards**

Use links only for active cards. Render the Dasmariñas card as an `<article>` with visible Coming Soon status and no arrow or destination.

- [ ] **Step 4: Add responsive three-card styling**

Use three columns on wide desktop, two columns at intermediate sizes, and one column on mobile. Style the inactive card consistently without hover navigation cues.

- [ ] **Step 5: Verify GREEN and lint**

Run: `node --test tests/homeBranches.test.js && npx eslint src/lib/homeBranches.js src/components/public/home/HomeEndingSections.jsx`

Expected: tests and lint pass.

### Task 4: Integration and Publication

**Files:**
- Modify only files identified by rendered findings.

**Interfaces:**
- Produces: verified and pushed `PreferedWebFlow` branch.

- [ ] **Step 1: Run focused and regression checks**

Run: `node --test tests/publicContent.test.js tests/publicBranding.test.js tests/homeBranches.test.js tests/partnershipInquiry.test.js`

Expected: zero failures.

- [ ] **Step 2: Run lint and build**

Run: `npm run lint && npm run build`

Expected: both succeed.

- [ ] **Step 3: Verify rendered desktop and mobile behavior**

At desktop and 390×844, inspect PPF Info, Ceramic, Nano Tint, Partnership, and Branches. Confirm no clipping or page-level horizontal overflow. Exercise one PPF package tab and empty partnership validation.

- [ ] **Step 4: Inspect scope and commit**

Run: `git diff --check && git status --short`

Commit: `fix: refine preferred homepage presentation`

- [ ] **Step 5: Push only the feature branch**

Run: `git push origin PreferedWebFlow`

Expected: `origin/PreferedWebFlow` advances and `main` remains untouched.
