# Branch Card Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved mock's responsive branch-card containment rules to the real homepage and push the verified correction to `PreferedWebFlow`.

**Architecture:** Keep the existing React markup and branch data unchanged. Correct the CSS grid geometry and type scale in `src/styles.css`, then use browser-measured DOM geometry as the behavior-level red/green regression check because the defect is rendered overflow rather than data logic.

**Tech Stack:** React 19, Vite 6, CSS, Node test runner, Codex in-app browser.

## Global Constraints

- Preserve the current website assets and Hakum visual system.
- Keep three branch cards in one row on large desktop screens.
- Keep two columns on tablet and one column on mobile.
- Keep `Coming Soon` visually separate from the Dasmariñas title.
- Do not alter branch destinations or branch data.

---

### Task 1: Correct the real branch-card layout

**Files:**
- Modify: `src/styles.css:299-309`
- Reference: Approved temporary HTML mock from the design review.

**Interfaces:**
- Consumes: Existing `.home-branch-grid`, `.home-branch-card`, and `.is-coming-soon` markup from `HomeEndingSections.jsx`.
- Produces: Responsive CSS with contained branch titles and a non-overlapping status label.

- [ ] **Step 1: Run the failing desktop geometry check**

Open the real homepage at 1860×1200 and evaluate each `.home-branch-card` and its `h3` using `scrollWidth > clientWidth`. Expected before the correction: the Dasmariñas card or title reports overflow/clipping.

- [ ] **Step 2: Implement the approved desktop rules**

Update the card to `position:relative`, reduce its grid tracks/gaps/padding, reduce the desktop heading maximum, remove the status from the grid by positioning it at the top-right, and add top padding to the coming-soon card.

- [ ] **Step 3: Implement the approved mobile rules**

At the existing mobile breakpoint, reduce the heading scale and retain enough title-column width that Dasmariñas stays contained without horizontal scrolling.

- [ ] **Step 4: Run the desktop and mobile geometry checks**

At 1860×1200 and 430×932, verify that the page, every branch card, and every branch title report `scrollWidth <= clientWidth`.

- [ ] **Step 5: Compare screenshots**

Capture the actual homepage at desktop and mobile widths and inspect both against the approved mock and the original defect screenshot.

### Task 2: Verify and publish

**Files:**
- Verify: `src/styles.css`
- Keep: `docs/superpowers/specs/2026-08-10-branch-card-containment-design.md`
- Keep: `docs/superpowers/plans/2026-08-10-branch-card-containment.md`

**Interfaces:**
- Consumes: The corrected production branch layout.
- Produces: A verified commit on `PreferedWebFlow` pushed to `origin`.

- [ ] **Step 1: Run focused and project checks**

Run `node --test tests/homeBranches.test.js`, `npm run lint`, and `npm run build`. All commands must exit 0.

- [ ] **Step 2: Review the diff**

Run `git diff --check` and inspect `git diff` to ensure only the approved branch-layout work, mock, and documentation are included.

- [ ] **Step 3: Commit and push**

Commit with `fix: contain responsive branch cards` and push `PreferedWebFlow` to `origin`.
