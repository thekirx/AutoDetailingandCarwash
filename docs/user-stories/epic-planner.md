# Epic: Planner & My Tasks

**Goal:** Assign work, collect proof, review — separate from bay money path.

## US-PLAN-01 · Planning board

**As** Branch Admin, Sales, or Ops Lead  
**I want** plan cards with categories and assignees  
**So that** shop work is tracked outside the wash queue  

**Acceptance**

- [x] Boards filter Planner / Equipment / Cash Advance
- [x] Editors create cards; staff see assigned rows only
- [x] Categories are first-class (`plan_categories`)

**Test seam:** `tests/plannerBoard.test.js`, `tests/plannerTasks.test.js`, `tests/planningPart6.test.js`

---

## US-PLAN-02 · Proof → review

**As** an assignee  
**I want** to submit photo proof when required  
**So that** editors accept or send back  

**Acceptance**

- [x] Proof optional unless `proof_required`
- [x] Private `plan-proofs` storage path
- [x] Review inbox: accept → `done`, send back → `in_progress`
- [x] Assign notifies inbox + web push

**Test seam:** `tests/plannerProofTransitions.test.js`, `tests/notifyPlanner.test.js`, `tests/principalQaFlows.test.js`

---

## US-PLAN-03 · My Tasks

**As** crew, detailer, marketing, or video editor  
**I want** `/operations/my-tasks`  
**So that** I only see cards assigned to me  

**Acceptance**

- [x] Empty state links planners to Planner when they can edit
- [x] SA nav does not list My Tasks as a primary books surface

**Test seam:** `tests/leftoverUxSeam.test.js`, `tests/planningUi.test.js`
