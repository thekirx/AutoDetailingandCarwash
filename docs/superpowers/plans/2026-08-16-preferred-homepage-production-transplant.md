# Preferred Homepage Production Transplant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public homepage with the approved `acfcec6` visual flow on the latest production code while preserving production data, routes, backend behavior, and deployment aliases.

**Architecture:** Keep `PublicLandingPage` as the production data-orchestration boundary and compose it from focused public-home components. Reuse production `PPF_PACKAGES`, `blogs`, `events`, branch hooks, and routes through small normalization helpers; copy only reference markup and scoped public CSS. The Partnership adapter remains browser-only and always returns an unavailable result.

**Tech Stack:** React 19, React Router 7, Vite 6, Supabase JS, Node test runner, ESLint, Vercel preview deployments.

## Global Constraints

- Base implementation on the latest fetched `origin/main` HEAD at implementation start.
- Do not merge, cherry-pick, or promote `PreferedWebFlow`.
- Do not change Supabase migrations, schema, RLS, permissions, roles, APIs, authentication, booking, queue, PWA, notifications, or internal routes.
- Do not render or lazy-load `PPFVisualizer` on the homepage.
- Use production Blog and Events tables, fields, routes, and publication rules.
- Partnership submission must perform no network request.
- Deploy only a new preview; do not touch `main`, production aliases, or production target.

---

### Task 1: Establish the production baseline

**Files:**
- Verify: `package.json`
- Verify: `.vercel/project.json` if present after project linking

**Interfaces:**
- Consumes: latest `origin/main`
- Produces: clean dedicated branch with installed dependencies and recorded baseline results

- [ ] **Step 1: Refresh and verify the base**

Run `git fetch origin --prune`, compare `git merge-base HEAD origin/main` with `git rev-parse origin/main`, and rebase the branch onto `origin/main` if production advanced.

- [ ] **Step 2: Install the locked dependencies**

Run `npm ci` so verification uses the committed lockfile.

- [ ] **Step 3: Run the baseline checks**

Run `node --test tests/*.test.js`, `npm run lint`, and `npm run build`. Record any pre-existing failure before editing.

### Task 2: Add production-safe homepage data adapters

**Files:**
- Modify: `src/data/publicHomeContent.js`
- Create: `src/lib/homepageContent.js`
- Create: `src/lib/homeBranches.js`
- Create: `src/lib/partnershipInquiry.js`
- Modify: `tests/publicHomeContent.test.js`
- Create: `tests/homepageContent.test.js`
- Create: `tests/homeBranches.test.js`
- Create: `tests/partnershipInquiry.test.js`

**Interfaces:**
- Consumes: `PPF_PACKAGES`, production Blog rows, production Event rows, `usePublicBranches` results
- Produces: `HOME_SECTION_IDS`, `ppfInformation`, `nanoCeramicTint`, `mediaGallery`, `buildPpfPackageCards()`, `loadHomepageContent(client)`, `buildHomeBranchCards()`, `validatePartnershipInquiry()`, and `submitPartnershipInquiry()`

- [ ] **Step 1: Write failing content-model tests**

Assert exact section order, Premium/Platinum ceramic ordering, the four PPF feature labels, three static PPF cards derived from `PPF_PACKAGES`, and local media assets.

- [ ] **Step 2: Write failing production Blog/Event adapter tests**

Use a small fake Supabase query builder and assert that Blog queries target `blogs`, Events queries target `events`, records normalize to internal `/blog/:slug` and `/events/:slug` links, and errors produce non-throwing error states.

- [ ] **Step 3: Write failing branch and Partnership tests**

Assert production branches remain linked, Dasmariñas is appended as a non-link coming-soon card, form values normalize, validation is field-specific, and `submitPartnershipInquiry()` returns `unavailable` without accepting a network client.

- [ ] **Step 4: Run the focused tests and confirm failure**

Run `node --test tests/publicHomeContent.test.js tests/homepageContent.test.js tests/homeBranches.test.js tests/partnershipInquiry.test.js` and confirm failures are caused by missing interfaces or old content.

- [ ] **Step 5: Implement the minimal adapters and models**

Add the approved reference copy/assets; derive package cards from existing `PPF_PACKAGES` without duplicating or inventing package details; query production fields only.

- [ ] **Step 6: Rerun the focused tests**

Expected: all focused data and adapter tests pass.

### Task 3: Compose the preferred homepage with production behavior

**Files:**
- Create: `src/components/public/ContentEmptyState.jsx`
- Create: `src/components/public/HybridMediaCard.jsx`
- Create: `src/components/public/home/HomeHeroSection.jsx`
- Create: `src/components/public/home/HomeServiceSections.jsx`
- Create: `src/components/public/home/PpfPackagesSection.jsx`
- Create: `src/components/public/home/LatestPostSection.jsx`
- Create: `src/components/public/home/EventsPreviewSection.jsx`
- Create: `src/components/public/home/PartnershipSection.jsx`
- Create: `src/components/public/home/HomeEndingSections.jsx`
- Modify: `src/pages/PublicLandingPage.jsx`
- Modify: `tests/publicBranding.test.js`
- Create: `tests/preferredHomepage.test.js`

**Interfaces:**
- Consumes: Task 2 models and adapters, `usePublicBranches`, production Supabase client, existing `/book`, `/blog`, `/events`, `/queue`, and branch routes
- Produces: exact homepage order Hero -> Ceramic -> PPF Information -> PPF Packages -> Nano Tint -> Media -> Latest Post -> Events -> Partnership -> Queue/Branches ending, with no About, general Services, or visualizer import

- [ ] **Step 1: Write failing page-contract tests**

Read the source files and assert the expected component order, no `about-section`, no general `services-section`, no `PPFVisualizer`, static package-card rendering, internal Blog/Event links, a Partnership form, and a non-link Dasmariñas article.

- [ ] **Step 2: Run the page-contract tests and confirm failure**

Run `node --test tests/publicBranding.test.js tests/preferredHomepage.test.js`.

- [ ] **Step 3: Add focused reference-derived components**

Transplant the approved semantic markup and motion hooks, adapting imports and props to Task 2 production interfaces. Keep the Hero buttons on production routes and retain the production live-queue ending.

- [ ] **Step 4: Recompose `PublicLandingPage`**

Remove local About/Services modal state and visualizer lazy loading. Load Blog/Event state through `loadHomepageContent(supabase)`, pass production branches to the ending section, and render the approved order.

- [ ] **Step 5: Rerun page and adapter tests**

Expected: the new homepage contract passes without changing shared routing or backend files.

### Task 4: Transplant and adapt the public visual system

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/publicBranding.test.js`
- Modify: `tests/preferredHomepage.test.js`

**Interfaces:**
- Consumes: Task 3 class names and current production public design tokens
- Produces: reference-aligned desktop/tablet/mobile layouts without affecting account, Operations, Admin, or internal page selectors

- [ ] **Step 1: Add failing CSS contract assertions**

Assert two-column ceramic layout, technical PPF stage, three static package cards, responsive split/media/content/Partnership grids, branch containment, 44px controls, and reduced-motion rules.

- [ ] **Step 2: Apply only the scoped reference CSS**

Transplant selectors for the new homepage components from `acfcec6`, preserve current global variables and all later production account/ops styles, and add static PPF card placeholder styling.

- [ ] **Step 3: Remove obsolete homepage-only rules where safe**

Delete About, featured Services modal, and visualizer-only rules only when no other route uses their class names. Do not remove Three.js dependencies from `package.json` unless repository-wide search proves they are unused outside the removed homepage import.

- [ ] **Step 4: Run CSS/page tests, lint, and build**

Run focused tests, `npm run lint`, and `npm run build`; fix only transplant-introduced issues.

### Task 5: Full regression and responsive verification

**Files:**
- No committed screenshots or temporary scripts
- Modify tests only if a real uncovered contract requires it

**Interfaces:**
- Consumes: completed homepage implementation
- Produces: build/test evidence and a short mismatch ledger against `acfcec6`

- [ ] **Step 1: Run the complete automated suite**

Run `node --test tests/*.test.js`, `npm run lint`, and `npm run build`.

- [ ] **Step 2: Start the production-like preview locally**

Run the built site using `npm run preview -- --host 127.0.0.1`.

- [ ] **Step 3: Verify desktop, tablet, and mobile rendering**

Check 1440x900, 834x1112, and 390x844 for page identity, visible content, console health, horizontal overflow, clipping, section order, PPF cards, form validation, internal content links, and branch-card behavior.

- [ ] **Step 4: Smoke-check preserved routes**

Check `/signin`, `/book`, `/queue`, `/blog`, `/events`, `/operations/login`, and the PWA manifest/service worker endpoints without performing production writes.

- [ ] **Step 5: Record intentional deviations**

Document production Blog/Event sourcing, static PPF cards replacing the 360-degree experience, non-submitting Partnership, and any layout adaptation required to retain current production chrome.

### Task 6: Create and verify a Vercel preview deployment

**Files:**
- Verify: `.vercel/project.json`
- No production configuration changes

**Interfaces:**
- Consumes: clean, verified working branch
- Produces: one READY Vercel preview URL with no production alias changes

- [ ] **Step 1: Confirm deployment scope**

Verify branch name, clean intended diff, linked project ID `prj_TLzytNx4o7XkyrQfrrd2G5ptTwfB`, and no production flags.

- [ ] **Step 2: Deploy as preview**

Use the Vercel preview deployment action from the project root. Do not use `--prod`, promote, rollback, or alias commands.

- [ ] **Step 3: Verify deployment status and homepage response**

Confirm status `READY`, fetch the preview URL, and repeat the key homepage and preserved-route smoke checks against the deployed artifact.

- [ ] **Step 4: Report the preview**

Return the preview URL, commit/branch, verification summary, and intentional deviations. Explicitly state that production was not changed.

