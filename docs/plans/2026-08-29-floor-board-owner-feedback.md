# Floor Board Owner Feedback Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply every owner markup on Super Admin Floor Board — remove duplicates/noise, fix wait KPI to average, clarify money/insights/chemical logic in UI — and leave the page compiling with green tests.

**Architecture:** UI-first changes in `src/pages/SuperAdminFloorBoard.jsx`. Wait KPI already has `averageWaitMinutes` in `src/lib/kpiPart8.js`; wire `avg_wait_minutes` from `fetchSuperAdminFloorBoard` in `src/queue/queueApi.js`. Insights/chemical keep existing aggregators; only copy + empty states change. No schema migrations. No money-contract changes.

**Tech Stack:** Vite + React 19, Supabase, Tailwind/shadcn ops chrome, `node:test`.

**Skills:** @writing-plans @fullstack-developer @find-bugs @verify @best-practices @ui-ux-pro-max @caveman-review @ponytail @finish-goal

**Repo root:** `c:\Users\jcuad\OneDrive\Documents\AutoDetailingandCarwash`

**Important WIP state:** Working tree already half-edits `SuperAdminFloorBoard.jsx` (removed `jobFilter` / imports but left Job details + Sales feed JSX). That leaves **undefined identifiers** (`jobFilter`, `jobs`, `setJobFilter`, `editBookingId`, `ticketQueueFamily`, `paymentMethodLabel`, `QueueTicketEditModal`). Task 0 restores a clean baseline from HEAD then applies the owner decisions cleanly.

---

## Deep image analysis — owner comments listed

### Image 1 — Detailing operations summary

| # | Markup (verbatim sense) | Target UI | Principal read |
|---|-------------------------|-----------|----------------|
| C1 | **"SEEMS DUPLICATE? WE CAN REMOVE UNLESS THERE IS A REASON?"** + bracket on **Cancelled** | Detailing ops tile: Cancelled · In timeline | Cancelled already exists on Detailing **LaneStrip** timeline tiles + Cancel loss money. **Remove Cancelled from Detailing ops summary.** Keep Completed in summary (pipeline end-state pulse) unless owner later cuts the whole strip. |

**Context:** Detailing ops summary (Assign / In shop / Final checking / For releasing / Completed [/ Cancelled]) largely **overlaps** Detailing Services `LaneStrip` above. Owner explicitly challenged **Cancelled**, not the whole strip. Decision: remove Cancelled only (YAGNI).

---

### Image 2 — Inventory / Jobs / Recent paid

| # | Markup | Target UI | Principal read |
|---|--------|-----------|----------------|
| C2 | **"WHATS THE LOGIC?"** → arrow on *"weekly chemical usage × unit cost charts"* | Chemical usage stub | Formula is Sunday recon: `usage = previous_qty − leftover_qty`; `cost = usage × product.price_minor`. Empty until submitted/approved recon. **Keep feature; rewrite copy.** |
| C3 | **"CAN BE REMOVED"** across Job details + Live/Completed/Cancelled/Mix tabs | Entire Jobs / Job details section | Owner cut. Also currently broken WIP. **Delete section.** Drill-down stays via lane tiles → queue boards / History. |
| C4 | Vertical bracket spanning Chemical → Jobs → Sales feed | Stack review | Bracket groups the lower stack for review. Explicit remove text is only on **Job details**. **Keep Sales feed** (paid POS feed is useful; not marked remove). |

---

### Image 3 — Insights: Car size & best sellers

| # | Markup | Target UI | Principal read |
|---|--------|-----------|----------------|
| C5 | **"WHATS THE LOGIC ON THIS ONE?"** + brace around both cards | Car size per sale + Best package/service | Logic exists: `aggregateCarSizePerSale(salesRows)` by `vehicle_type`; `aggregateBestSellers(sale_line_items)` by `line_total_minor`. Empty = no paid sized sales / no line items in timeline. **Keep cards; add logic hint + clearer empty states.** |

---

### Image 4 — Tempo KPI

| # | Markup | Target UI | Principal read |
|---|--------|-----------|----------------|
| C6 | **"SHOULD BE AVERAGE WAITING TIME"** | Total waiting time · "Sum of wait → start" | Change label + math to **average** (`averageWaitMinutes`). Show `—` when no wait stamps. |
| C7 | **"? WHATS THE LOGIC FOR THIS ONE?"** + `?` on dash | Avg time per service · "In progress → finish" | Keep metric. Clarify: avg of `in_progress_at → for_payment_at \|\| completed_at \|\| final_checking_at`. Dash = no tickets with both stamps in timeline. |

---

### Image 5 — Money: Financials

| # | Markup | Target UI | Principal read |
|---|--------|-----------|----------------|
| C8 | **"REMOVE TOTAL SALES!"** | Total Sales · All POS · paid | Remove tile. |
| C9 | **"ALWAYS SAME"** bracket Total Sales ↔ Counter / POS Sales | Redundant when queue (carwash) ≈ ₱0 | Removing Total Sales fixes the confusing twin. Keep **Queue app sales** + **Counter / POS sales** as the real split. |
| C10 | **"WHAT IS PAID TICKETS?"** | Paid Tickets · Sale rows | Rename to **Paid sales**; hint = count of paid sale rows (not pesos). |

---

## Decision scoreboard

| ID | Action |
|----|--------|
| C1 | Remove Detailing ops **Cancelled** tile |
| C2 | Rewrite chemical usage logic copy |
| C3 | Remove Job details section (+ dead state/imports) |
| C4 | **Keep** Sales feed |
| C5 | Insights logic hints + empty states |
| C6 | Avg waiting time (not total) |
| C7 | Clarify avg service time logic |
| C8–C9 | Remove Total sales tile |
| C10 | Rename Paid tickets → Paid sales |

**Out of scope:** Weather, new chart libs, Finance P&L redesign, Sunday recon workflow changes, committing Brand Assets / skill markdowns.

---

## Caveman review (against HEAD + WIP)

- `SuperAdminFloorBoard.jsx` WIP: 🔴 bug: Job details JSX references removed `jobFilter`/`jobs`/`editBookingId`. Restore from HEAD then apply cuts — do not ship WIP.
- HEAD Detailing ops Cancelled tile: 🔴 owner C1 — remove.
- HEAD Total sales tile: 🔴 owner C8/C9 — remove.
- HEAD Total waiting time + `kpi.total_wait_minutes`: 🔴 owner C6 — switch to avg.
- HEAD Paid tickets: 🔴 owner C10 — rename + hint.
- HEAD Job details: 🔴 owner C3 — delete section.
- HEAD Avg service / Insights / Chemical: 🟡 risk: empty with no formula — owner C2/C5/C7.
- LaneStrip Completed/Cancelled `setJobFilter`: 🟡 risk after Job details removal — rewire to History / family lane.

---

## Find-bugs surface (this slice)

| Surface | Notes |
|---------|-------|
| Inputs | Branch + date preset only — unchanged |
| DB | Read-only floor fetch — no migration |
| Auth | `canViewQueueOperations` unchanged |
| Business logic | Wait sum → avg (requested). Display-only money tile removal |
| XSS / CSRF / IDOR | N/A for this UI trim |

---

### Task 0: Reset broken WIP, then re-apply from clean HEAD

**Files:**
- Modify: `src/pages/SuperAdminFloorBoard.jsx`

**Step 1: Restore file from last good commit**

```bash
git checkout HEAD -- src/pages/SuperAdminFloorBoard.jsx
```

Expected: file matches HEAD (has Total sales, Job details, Total waiting time, Cancelled tile, Paid tickets).

**Step 2: Confirm no undefined identifiers**

```bash
npx eslint src/pages/SuperAdminFloorBoard.jsx
```

Expected: 0 errors (or only known project warnings)

**Step 3: Commit only if needed** — skip commit if Step 1 is the only action before Task 1; otherwise:

```bash
git add src/pages/SuperAdminFloorBoard.jsx
git commit -m "chore(floor): reset half-applied owner feedback WIP"
```

---

### Task 1: Wait KPI = average (TDD)

**Files:**
- Test: `tests/kpiPart8.test.js` (create or extend)
- Modify: `src/queue/queueApi.js` (kpi object in `fetchSuperAdminFloorBoard`)
- Modify: `src/pages/SuperAdminFloorBoard.jsx` Tempo section

**Step 1: Write failing / confirming test**

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { averageWaitMinutes, totalWaitMinutes } from '../src/lib/kpiPart8.js'

describe('floor wait KPI', () => {
  it('averages wait→start; total is sum', () => {
    const bookings = [
      { waiting_at: '2026-08-01T10:00:00Z', in_progress_at: '2026-08-01T10:10:00Z' },
      { waiting_at: '2026-08-01T11:00:00Z', in_progress_at: '2026-08-01T11:20:00Z' },
    ]
    assert.equal(totalWaitMinutes(bookings), 30)
    assert.equal(averageWaitMinutes(bookings), 15)
  })
  it('returns null when no wait stamps', () => {
    assert.equal(averageWaitMinutes([{ status: 'waiting' }]), null)
  })
})
```

**Step 2: Run**

```bash
node --test tests/kpiPart8.test.js
```

Expected: PASS (helpers already correct)

**Step 3: Wire API**

In `fetchSuperAdminFloorBoard` kpi block:

```js
const avgWait = averageWaitMinutes(startedJobs)
const avg = averageCycleMinutes(cycleSample)
const kpi = {
  avg_wait_minutes: avgWait == null ? null : Math.round(avgWait),
  avg_service_minutes: avg == null ? null : Math.round(avg),
  failed_qa_count: failedQaCount(redoJobs),
  cancelled_count: cancelledJobs.length,
}
```

Remove `total_wait_minutes` from floor board empty/default kpi objects. Grep and update any EMPTY kpi stubs.

**Step 4: UI Tempo tiles**

```jsx
<StatTile
  label="Avg waiting time"
  value={kpi.avg_wait_minutes == null ? '—' : formatMinutes(kpi.avg_wait_minutes)}
  hint="waiting_at → in_progress_at (avg)"
  breakdown="Average minutes from bay wait stamp to service start for tickets that have both timestamps in this timeline."
/>
<StatTile
  label="Avg time per service"
  value={kpi.avg_service_minutes == null ? '—' : formatMinutes(kpi.avg_service_minutes)}
  hint="in_progress → finish"
  breakdown="Average minutes from in_progress_at to for_payment_at (else completed_at / final_checking_at). Shows — when no tickets in the timeline have both stamps."
/>
```

**Step 5: Verify + commit**

```bash
node --test tests/kpiPart8.test.js
git add tests/kpiPart8.test.js src/lib/kpiPart8.js src/queue/queueApi.js src/pages/SuperAdminFloorBoard.jsx
git commit -m "fix(floor): average waiting time KPI instead of total sum"
```

---

### Task 2: Money tiles (C8–C10)

**Files:**
- Modify: `src/pages/SuperAdminFloorBoard.jsx` Financials section

**Step 1: Delete Total sales `StatTile`.**

**Step 2: Rename Paid tickets:**

```jsx
<StatTile
  label="Paid sales"
  value={financials.paid_count ?? 0}
  hint="Count of paid sale rows in timeline"
  breakdown="Number of paid sales records (not peso amount). Queue and counter each add one row when paid."
/>
```

**Step 3: Commit**

```bash
git add src/pages/SuperAdminFloorBoard.jsx
git commit -m "fix(floor): remove total sales tile; clarify paid sales count"
```

---

### Task 3: Remove Detailing ops Cancelled (C1)

**Files:**
- Modify: `src/pages/SuperAdminFloorBoard.jsx` Detailing ops summary

**Step 1:** Delete Cancelled `StatTile` only.

**Step 2:** Keep grid at `xl:grid-cols-5` for Assign / In shop / Final checking / For releasing / Completed.

**Step 3:** Keep Cancelled on Detailing `LaneStrip` timeline + Cancel loss money.

**Step 4: Commit**

```bash
git add src/pages/SuperAdminFloorBoard.jsx
git commit -m "fix(floor): drop duplicate cancelled tile from detailing ops summary"
```

---

### Task 4: Remove Job details; keep Sales feed; rewire clicks (C3–C4)

**Files:**
- Modify: `src/pages/SuperAdminFloorBoard.jsx`

**Step 1: Rewire LaneStrip timeline clicks**

```js
onClick: () => openHistory(row.id),
```

Where `openHistory` navigates to `/operations/history?status=…&branch=…`.

**Step 2: Rewire Detailing ops Completed** to `openHistory('completed')` (or `openFamilyLane` if board supports it).

**Step 3: Delete entire Jobs / Job details section** (tabs + card grid + modal if only used here).

**Step 4: Keep Recent paid / Sales feed.** Ensure `paymentMethodLabel` import remains.

**Step 5: Remove dead `jobFilter` / `editBookingId` / unused imports only if Job details was their sole consumer.**

**Step 6: Commit**

```bash
git add src/pages/SuperAdminFloorBoard.jsx
git commit -m "fix(floor): remove job details list per owner; keep sales feed"
```

---

### Task 5: Insights + chemical copy (C2, C5, C7)

**Files:**
- Modify: `src/pages/SuperAdminFloorBoard.jsx`
- Create (optional, one page): `docs/OPS/FLOOR-BOARD-METRICS.md`

**Step 1: Car size card** — under title:

```text
Logic: each paid sale in the timeline counts once by booking vehicle size. Bar = count; amount = sum of sale totals.
```

Empty: `No sized sales in this timeline — need paid sales with a vehicle size on the booking.`

**Step 2: Best sellers** —

```text
Logic: ranks sale line items for paid sales in the timeline by peso total. Top names shown.
```

Empty: `No line items to rank — paid sales need package/service/POS line items.`

**Step 3: Chemical stub** —

```text
Logic (Sunday recon): Branch admins submit weekly leftover counts. Usage = previous − leftover per product. Cost = usage × unit cost. Charts appear after at least one submitted or approved recon in the timeline.
```

**Step 4: Commit**

```bash
git add src/pages/SuperAdminFloorBoard.jsx docs/OPS/FLOOR-BOARD-METRICS.md
git commit -m "docs(floor): owner-readable logic for insights and chemical usage"
```

---

### Task 6: Source-scan test + verify gate

**Files:**
- Create/Modify: `tests/floorBoardOwnerFeedback.test.js`

**Step 1: Failing-then-passing source scan**

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const src = readFileSync(new URL('../src/pages/SuperAdminFloorBoard.jsx', import.meta.url), 'utf8')

describe('floor board owner feedback cuts', () => {
  it('has no total sales tile or total waiting label', () => {
    assert.doesNotMatch(src, /label=["']Total sales["']/i)
    assert.doesNotMatch(src, /Total waiting time/i)
  })
  it('uses avg waiting + paid sales labels', () => {
    assert.match(src, /Avg waiting time/)
    assert.match(src, /Paid sales/)
  })
  it('removed job details section', () => {
    assert.doesNotMatch(src, /title=["']Job details["']/)
  })
  it('keeps sales feed and drops detailing-ops cancelled tile block', () => {
    assert.match(src, /Sales feed|Recent paid/)
    // Cancelled tile may still exist on LaneStrip; detailing ops summary must not map cancelled alone as a sixth tile with setJobFilter
    assert.doesNotMatch(src, /label=["']Cancelled["'][\s\S]{0,120}setJobFilter\(['"]cancelled['"]\)/)
  })
})
```

**Step 2: Run**

```bash
node --test tests/kpiPart8.test.js tests/floorBoardOwnerFeedback.test.js tests/ownerRevisionsPhase7.test.js tests/floorBoardLanes.test.js
```

Expected: exit 0, all pass

**Step 3: Lint + build**

```bash
npx eslint src/pages/SuperAdminFloorBoard.jsx src/queue/queueApi.js
npm run build
```

Expected: 0 eslint errors on touched files; build exit 0

**Step 4: Commit**

```bash
git add tests/floorBoardOwnerFeedback.test.js
git commit -m "test(floor): lock owner feedback cuts on floor board"
```

---

## Manual owner-demo checklist

- [ ] Detailing ops: 5 tiles, **no Cancelled**
- [ ] Money: **no Total sales**; Queue + Counter remain; **Paid sales** label
- [ ] Tempo: **Avg waiting time**; Avg service shows — or minutes with hint
- [ ] **No Job details** section
- [ ] **Sales feed** still present
- [ ] Insights + chemical copy answers “what’s the logic?”
- [ ] Lane Completed/Cancelled still clickable → History

---

## UI/UX + best-practices notes

- Density: keep existing StatTile grid; no new card chrome
- Empty states: why empty + what to do next
- Touch: keep `min-h-11` controls
- No emoji icons; Lucide only where already used
- No new dependencies; delete dead code (no commented leftovers)

---

## Done definition (finish-goal)

1. All C1–C10 decisions implemented  
2. No broken undefined identifiers on Floor Board  
3. Listed `node --test` suites exit 0  
4. `npm run build` exit 0  
5. Manual checklist above checked  
6. Floor Board has no: Total sales tile, Total waiting time, Job details, Detailing-ops Cancelled tile  

---

## Execution handoff

Plan complete and saved to `docs/plans/2026-08-29-floor-board-owner-feedback.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** — I implement task-by-task here, verify after each task, finish until done  

**2. Parallel Session** — open a new session with executing-plans against this plan file  

**Which approach?**
