# Team Portal Daylight Implementation Plan

**Goal:** Restyle the existing operations portal to the approved Daylight design, frontend only.
**Spec:** docs/handoff/team-portal-daylight/GUIDE.md and approved-mock-option-b-daylight.html.
**Execution:** Implement in this chat; stop with screenshots after every guide screen. No commits or pushes.

## Constraints
- Preserve all data queries, API/RPC implementations, auth/permissions, routes and stored statuses.
- Use only fields already loaded; never infer unavailable lane totals as zero.
- Preserve existing mutation functions and action permission checks; no live mutation during QA.
- Leave pre-existing uncommitted files untouched. Put new styling in a scoped stylesheet.

## Step 1 — Team lead queue (5a), with its required floor-shell chrome (4a)
- [ ] Test display grouping, duplicate removal, missing lane totals, stale durations and longest wait.
- [ ] Implement pure presentation helpers and queue cards; reuse existing assign modal, payment and redo functions.
- [ ] Add scoped Daylight tokens, navy identity/header/dock/rail, white grouped cards, four-cell summary, optional filters and search-triggered history.
- [ ] Preserve every loaded lane, including Redo and Cancelled; collapse Done by default.
- [ ] Run unit tests, lint, build, browser checks; update graph if available.
- [ ] Capture 375/768/1024/1440 screenshots, append CHANGES.log and stop for review.

## Step 2 — Crew Time clock (5b)
Restyle existing attendance state and buttons, omit shift/history not already loaded; screenshots and log; stop.

## Step 3 — Admin Today (5c), with command-shell chrome (4b)
Restyle loaded KPIs, stage counts and derived links, omit unavailable comparisons; screenshots and log; stop.

## Step 4 — Shared kit and remaining pages (5d)
Apply shared presentation and glossary; preserve page logic and links; verify both shells and full suite; screenshots and log; stop.
