# Floor Board Owner Markup — Principal Re-Audit & Permanent Fix Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permanently satisfy every owner handwritten comment on Super Admin Floor Board (Money, Tempo, Insights, Inventory/Jobs, Detailing ops) with correct math, clear labels, and insights that surface real sale data when it exists.

**Architecture:** UI + `fetchSuperAdminFloorBoard` vertical slice. No schema migrations. Money contract unchanged. Insights get a **fallback** when `sale_line_items` are missing so best-sellers are not falsely empty. KPI exposes sample counts so `—` / `0m` is explainable.

**Tech Stack:** Vite + React, Supabase PostgREST, `node:test`, existing `kpiPart8` / `ownerRevisionsPhase7` / `crmInsights` helpers.

**Skills:** @writing-plans @fullstack-developer @find-bugs @verify @best-practices @ui-ux-pro-max @caveman-review @ponytail @finish-goal

**Repo:** `c:\Users\jcuad\OneDrive\Documents\AutoDetailingandCarwash`  
**Baseline:** `a5e400e` already shipped UI cuts C1–C10. This plan closes **permanent data/clarity gaps**.

---

## Deep image analysis — owner comments (verbatim sense)

### Image A — MONEY / Financials

| ID | Handwritten / mark | Exact target | Principal decision |
|----|--------------------|--------------|--------------------|
| C8 | **"REMOVE TOTAL SALES!"** | TOTAL SALES tile (₱ · All POS · paid) | **Delete tile** |
| C9 | **"ALWAYS SAME"** + bracket Total ↔ Counter/POS | Redundant when queue≈0 | Removing Total Sales is the fix; keep Queue + Counter split |
| C10 | **"WHAT IS PAID TICKETS?"** | PAID TICKETS · Sale rows | Rename **Paid sales**; hint = count of paid sale **rows**, not pesos |

### Image B — TEMPO / KPI

| ID | Handwritten / mark | Exact target | Principal decision |
|----|--------------------|--------------|--------------------|
| C6 | **"SHOULD BE AVERAGE WAITING TIME"** | TOTAL WAITING TIME · Sum of wait→start | Label + math → **average** (`averageWaitMinutes` → `avg_wait_minutes`); `—` when no stamps |
| C7 | **"? WHATS THE LOGIC FOR THIS ONE?"** on dash | AVG TIME PER SERVICE | Keep; document `in_progress → for_payment \|\| completed \|\| final_checking`; show sample count so dash is not a mystery |
| — | (none) | FAILED QA | Keep as-is |

### Image C — INSIGHTS / Car size & best sellers

| ID | Handwritten / mark | Exact target | Principal decision |
|----|--------------------|--------------|--------------------|
| C5 | Brace + **"WHATS THE LOGIC ON THIS ONE?"** | Both cards | Keep cards; owner-readable logic copy; empty only when no paid sales / no rankable lines; **fallback** best-sellers from booking `service_name` when line items absent |

### Image D — INVENTORY / JOBS / RECENT PAID

| ID | Handwritten / mark | Exact target | Principal decision |
|----|--------------------|--------------|--------------------|
| C2 | Arrow + **"WHAT'S THE LOGIC?"** | Chemical usage stub | Keep; Sunday recon formula: `usage = previous − leftover`; `cost = usage × unit cost` |
| C3 | **"CAN BE REMOVED"** + X on Job details | Entire Jobs section | **Delete** Job details + filters + edit modal |
| C4 | Vertical margin line past Jobs into Sales feed | Stack review | Explicit remove text is **only** on Job details → **Keep Sales feed** |

### Image E — DETAILING OPS summary

| ID | Handwritten / mark | Exact target | Principal decision |
|----|--------------------|--------------|--------------------|
| C1 | **"SEEMS DUPLICATE? WE CAN REMOVE UNLESS THERE IS A REASON?"** + bracket on **Cancelled** | Cancelled · In timeline | Remove **Cancelled** from Detailing ops only (still on Detailing LaneStrip + Cancel loss) |

---

## Ship status vs permanent gaps (`a5e400e`)

| ID | UI ship | Permanent gap remaining |
|----|---------|-------------------------|
| C1 | Done — Cancelled tile gone | None |
| C2 | Done — formula copy | None (empty until recon = correct) |
| C3 | Done — Job details gone | None |
| C4 | Done — Sales feed kept | None |
| C5 | Partial — copy only | Best sellers empty when sales exist but line query empty → **fallback**; label `unknown` size |
| C6 | Done — avg wait wired | Expose wait sample count in hint |
| C7 | Partial — breakdown copy | Expose cycle sample count; clearer empty hint |
| C8–C9 | Done | None |
| C10 | Done — Paid sales | None |

**Screenshot note:** Owner images show pre-`a5e400e` UI (Total sales, Paid tickets, Job details). Code on `main` already differs. This pass hardens data + clarity so live ops never look “broken” when data exists.

---

## Find-bugs (slice surface)

| Surface | Assessment |
|---------|------------|
| Inputs | Branch + date range only |
| DB | Read-only `sales` / `sale_line_items` / `bookings` / `inventory_recons` |
| Auth | `canViewQueueOperations` unchanged |
| Business logic | Avg wait (not sum); best-seller fallback must not double-count when lines exist |
| XSS / CSRF / IDOR | N/A (display) |

**Caveman (pre-fix):**
- `queueApi.js`: 🟡 risk: `bestSellers` silent empty if lines missing while `salesRows` has `service_name`. Fallback from sales.
- `SuperAdminFloorBoard.jsx`: 🟡 risk: KPI `—` / `0m` without sample N confuses owner (C7). Show stamp counts.
- `aggregateCarSizePerSale`: 🔵 nit: `unknown` size — display as “No size on booking”.

---

### Task 1: Failing tests for KPI sample counts + best-seller fallback

**Files:**
- Modify: `tests/kpiPart8.test.js` (or extend `tests/floorBoardOwnerFeedback.test.js`)
- Create/Modify: `tests/floorBoardInsightsFallback.test.js`

**Step 1: Write failing assertions**

```js
// floor board returns kpi with wait_sample_n / cycle_sample_n in source
assert.match(api, /wait_sample_n/)
assert.match(api, /cycle_sample_n/)
// fallback helper or inline: sales with service_name → best sellers when lines empty
```

**Step 2: Run — expect FAIL until Task 2–3**

Run: `node --test tests/floorBoardOwnerFeedback.test.js tests/kpiPart8.test.js`

---

### Task 2: Wire KPI sample counts in API + UI

**Files:**
- Modify: `src/queue/queueApi.js` (kpi object)
- Modify: `src/pages/SuperAdminFloorBoard.jsx` (Tempo hints)

```js
const waitMins = startedJobs.map(bookingWaitMinutes).filter(...)
// or count from averageWaitMinutes path:
wait_sample_n: /* number of tickets with both wait stamps */,
cycle_sample_n: /* number with cycle stamps */,
```

UI:
- Avg waiting: hint includes `n tickets` or `No wait stamps in timeline`
- Avg service: same for cycle

---

### Task 3: Best-sellers fallback when line items empty

**Files:**
- Modify: `src/queue/queueApi.js` after `aggregateBestSellers`
- Optionally: `src/lib/ownerRevisionsPhase7.js` helper `bestSellersFromSales(salesRows)`

```js
if (!bestSellers.length && salesRows.length) {
  bestSellers = aggregateBestSellers(
    salesRows
      .filter((s) => s.service_name)
      .map((s) => ({
        name: s.service_name,
        item_type: 'service',
        line_total_minor: s.total_minor,
      })),
    8,
  )
}
```

UI car size: map `unknown` → `No size on booking`.

---

### Task 4: Source-scan regression + docs

**Files:**
- Modify: `tests/floorBoardOwnerFeedback.test.js`
- Modify: `docs/OPS/FLOOR-BOARD-METRICS.md`

Assert: no Total sales / Job details / Paid tickets / Total waiting; has Paid sales / Avg waiting / Sales feed / Usage = previous; api has wait_sample_n + fallback path.

---

### Task 5: Verify + push

```bash
node --test tests/floorBoardOwnerFeedback.test.js tests/kpiPart8.test.js tests/superAdminFloor.test.js tests/floorBoardLanes.test.js
npx eslint src/pages/SuperAdminFloorBoard.jsx src/queue/queueApi.js
npm run build
git add … && git commit && git push
```

---

## Out of scope

- Removing Sales feed (owner did not write remove on it)
- Removing whole Detailing ops strip
- Sunday recon workflow / schema
- Brand Assets / skill markdown dumps
- New chart libraries

---

## Execution

Proceed **this session** (finish-goal): Tasks 1→5 without stopping.
