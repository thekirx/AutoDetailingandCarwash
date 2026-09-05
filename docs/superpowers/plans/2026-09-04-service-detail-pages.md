# Service Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put each protection package, real proof video, and focused FAQ on its matching service page while removing the standalone Packages destination.

**Architecture:** A small service-detail data module owns service-specific FAQs and module configuration, while shared React sections render FAQs, proof media, and the bottom CTA. Route resolution is a pure catalog helper so service-card destinations can be tested independently. PPF alone opts into a requestAnimationFrame-based scroll hero treatment.

**Tech Stack:** React 19, React Router 7, Vite 6, Node test runner, CSS, native HTML video, ffmpeg.

**Spec:** `docs/superpowers/specs/2026-09-04-service-detail-pages-design.md`

## Global Constraints

- Work only in the existing `codex/bredesign` worktree.
- PPF scroll animation is limited to `/services/ppf` and respects reduced motion.
- PPF, Ceramic, and Tint FAQ sets may contain only questions about their named service.
- Carwash routes to `/queue`; Interior Detailing and Glass Detailing route to `/book`.
- Both Ceramic packages highlight `Unlimited Recoating` without inventing conditions.
- Proof uses genuine Hakum footage from the supplied Drive folders.
- ClearPro claims must be supported by official ClearPro sources.

---

### Task 1: Service content contracts and catalog destinations

**Files:**
- Create: `src/data/serviceDetailContent.js`
- Modify: `src/lib/publicCatalog.js`
- Test: `tests/serviceDetailContent.test.js`

**Interfaces:**
- Produces: `SERVICE_DETAIL_CONTENT`, keyed by `ppf`, `ceramic`, and `tint`.
- Produces: `publicServiceDestination(item)` returning `{ to, state? }`.

- [ ] **Step 1: Write failing behavior tests**

```js
assert.equal(publicServiceDestination({ slug: 'premium-car-wash', title: 'Carwash' }).to, '/queue')
assert.equal(publicServiceDestination({ slug: 'paint-protection-film', title: 'PPF' }).to, '/services/ppf')
assert.equal(publicServiceDestination({ slug: 'ceramic-coating', title: 'Ceramic' }).to, '/services/ceramic')
assert.equal(publicServiceDestination({ slug: 'nano-ceramic-tint', title: 'Tint' }).to, '/services/tint')
assert.equal(publicServiceDestination({ slug: 'interior-detailing', title: 'Interior' }).to, '/book')
assert.ok(SERVICE_DETAIL_CONTENT.tint.faqs.every(({ question, answer }) => !/ppf|ceramic coating/i.test(`${question} ${answer}`)))
```

- [ ] **Step 2: Run `node --test tests/serviceDetailContent.test.js` and confirm failures are caused by the missing exports.**
- [ ] **Step 3: Add literal service FAQ sets, proof metadata, CTA metadata, and the pure destination resolver.**
- [ ] **Step 4: Re-run the test and confirm it passes.**
- [ ] **Step 5: Commit the content contract and route resolver.**

### Task 2: Remove the Packages destination and route service cards

**Files:**
- Modify: `src/layouts/PublicLayout.jsx`
- Modify: `src/pages/PublicPages.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/PublicPageMeta.jsx`
- Test: `tests/publicServiceRoutes.test.js`

**Interfaces:**
- Consumes: `publicServiceDestination(item)` from Task 1.
- Produces: visible service cards with correct destinations and `/packages` redirect behavior.

- [ ] **Step 1: Write a failing rendered-route test that opens `/services`, clicks representative cards, and observes the expected URL.**
- [ ] **Step 2: Run `node --test tests/publicServiceRoutes.test.js` and confirm the current cards incorrectly point to `/book`.**
- [ ] **Step 3: Use the resolver in `ServicesPage`, remove Packages from navigation, delete the lazy Packages page export usage, and map `/packages` to `<Navigate to="/services" replace />`.**
- [ ] **Step 4: Re-run route tests and targeted public catalog tests.**
- [ ] **Step 5: Commit the navigation and routing change.**

### Task 3: PPF-only scroll hero

**Files:**
- Create: `src/lib/serviceHeroMotion.js`
- Modify: `src/components/public/bredesign/BdPageHero.jsx`
- Modify: `src/pages/ServiceDetailPage.jsx`
- Modify: `src/styles/bredesign.css`
- Test: `tests/serviceHeroMotion.test.js`

**Interfaces:**
- Produces: `serviceHeroProgress(scrollY, heroHeight)` clamped to `[0, 1]`.
- `BdPageHero` accepts `scrollAnimated={false}`.

- [ ] **Step 1: Write failing tests for zero, midpoint, end, overflow, and zero-height progress.**
- [ ] **Step 2: Run `node --test tests/serviceHeroMotion.test.js` and verify the helper is missing.**
- [ ] **Step 3: Implement the pure progress helper and a passive, requestAnimationFrame-coalesced effect that writes a CSS custom property only when `scrollAnimated` is true and reduced motion is off.**
- [ ] **Step 4: Pass `scrollAnimated={slug === 'ppf'}` and add transforms for PPF hero media/copy.**
- [ ] **Step 5: Re-run tests and commit the hero behavior.**

### Task 4: Local proof-video assets

**Files:**
- Create: `src/assets/service-proof/ppf-proof.mp4`
- Create: `src/assets/service-proof/ppf-proof-poster.webp`
- Create: `src/assets/service-proof/ceramic-proof.mp4`
- Create: `src/assets/service-proof/ceramic-proof-poster.webp`

**Interfaces:**
- Produces: web-local MP4 and poster pairs consumed by `SERVICE_DETAIL_CONTENT`.

- [ ] **Step 1: Download `ppf 01.mp4` and `CR-V CERAMIC 30 SEC.mp4` from the authenticated Drive results into a temporary directory.**
- [ ] **Step 2: Inspect duration, dimensions, orientation, codecs, and representative frames with `ffprobe` and `ffmpeg`.**
- [ ] **Step 3: If both clearly show the named service, transcode H.264/AAC MP4 files capped for web playback and generate WebP posters; otherwise choose the next clearly named clip in the same folder and repeat inspection.**
- [ ] **Step 4: Verify both local videos decode and posters have non-zero dimensions.**
- [ ] **Step 5: Commit the optimized proof assets.**

### Task 5: Shared FAQ, proof, and bottom CTA sections

**Files:**
- Create: `src/components/public/bredesign/ServiceFaqSection.jsx`
- Create: `src/components/public/bredesign/ServiceProofSection.jsx`
- Create: `src/components/public/bredesign/ServiceBottomCta.jsx`
- Modify: `src/styles/bredesign.css`
- Test: `tests/serviceDetailSections.test.js`

**Interfaces:**
- Consumes: `faqs`, `proof`, and `cta` from `SERVICE_DETAIL_CONTENT`.
- Produces: accessible disclosure buttons, native proof video, and service-prefilled booking CTA.

- [ ] **Step 1: Write failing component behavior tests for FAQ expansion, video attributes, and CTA destination state.**
- [ ] **Step 2: Run `node --test tests/serviceDetailSections.test.js` and confirm components are missing.**
- [ ] **Step 3: Implement focused components using native buttons, `<video controls preload="metadata">`, and React Router links.**
- [ ] **Step 4: Add responsive dark-theme styles and re-run tests.**
- [ ] **Step 5: Commit the shared service sections.**

### Task 6: PPF and Ceramic packages inside service pages

**Files:**
- Modify: `src/components/public/home/PpfPackagesSection.jsx`
- Modify: `src/components/public/home/HomeServiceSections.jsx`
- Modify: `src/data/publicHomeContent.js`
- Modify: `src/pages/ServiceDetailPage.jsx`
- Modify: `src/styles.css`
- Modify: `src/styles/bredesign.css`
- Test: `tests/servicePackagePlacement.test.js`

**Interfaces:**
- Consumes: existing `PPF_PACKAGES` and `ceramicPackages`.
- Produces: reusable package sections rendered only for their matching service slug.

- [ ] **Step 1: Write failing tests that assert PPF packages render on `/services/ppf`, Ceramic packages render on `/services/ceramic`, both Ceramic cards expose Unlimited Recoating, and Tint renders neither package family.**
- [ ] **Step 2: Run the test and confirm service pages currently omit packages.**
- [ ] **Step 3: Make the existing package sections reusable without changing their pricing/package content; add `Unlimited Recoating` to both Ceramic package inclusions and a visible shared highlight.**
- [ ] **Step 4: Compose service pages in the approved order: benefits, PPF information when applicable, packages, proof, FAQs, CTA.**
- [ ] **Step 5: Re-run service placement and existing package tests, then commit.**

### Task 7: Final content, performance, and rendered verification

**Files:**
- Modify: `src/components/public/bredesign/content.js`
- Modify: `src/data/serviceDetailContent.js`
- Modify: tests only if a genuine uncovered behavior is found first

**Interfaces:**
- Consumes all prior tasks.
- Produces the completed user-facing service flow.

- [ ] **Step 1: Replace unsupported PPF prose with official-source-backed ClearPro wording and add the ClearPro link under Why PPF.**
- [ ] **Step 2: Run targeted Node tests for service content, routes, hero motion, package placement, and shared sections.**
- [ ] **Step 3: Run existing public-site tests and `npm run build`.**
- [ ] **Step 4: At `http://127.0.0.1:4173`, verify `/services/ppf`, `/services/ceramic`, `/services/tint`, `/services`, and `/packages` at desktop and mobile widths; check console, overflow, video, FAQ interaction, destinations, and PPF-only motion.**
- [ ] **Step 5: Review React changes for stable module-level data, conditional media loading, passive listeners, reduced-motion handling, and unnecessary re-renders.**
- [ ] **Step 6: Commit the completed integration.**

