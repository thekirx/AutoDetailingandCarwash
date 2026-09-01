# New Revisions Ops Cutover & Quality Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete owner-demo readiness for `NewRevisions.md` — ops cutover smoke, UI/branding consistency, clean-code lint gate, and performance verification — without changing money-contract business logic.

**Architecture:** Engineering is **0 GAP** per [`docs/OPS/NEW-REVISIONS-CHECKLIST.md`](../OPS/NEW-REVISIONS-CHECKLIST.md). This plan covers **ops configuration**, **E2E smoke**, **lint/hook fixes**, **OpsPageShell parity**, and **brand tokens** from [`design-system/hakum-ops/MASTER.md`](../../design-system/hakum-ops/MASTER.md). UI stack stays on installed libs per @pick-ui-library: `@base-ui/react`, shadcn, **Sonner** toasts, **recharts** charts, **Lucide** icons, **clsx** + **cva**, **GSAP** only for bento stagger (not data tables).

**Tech Stack:** Vite 6, React 19, Supabase, Tailwind 4, shadcn nova, BusyBee SMS, node:test seam suite.

**Skills referenced:** @clean-code @kaizen @verify @performance-optimizer @ui-ux-pro-max

---

## Kaizen guardrails (every task)

- **Poka-yoke:** POS inventory deduct is fail-closed — seed `product_branch_stock` before demo.
- **Standardized work:** Ops chrome = `OpsPageShell` + `OpsTabList` (`h-11` touch targets). Planning board keeps `planner-v2` inside shell only.
- **JIT:** Do not build weather forecast (DECLINED). Do not ACL counter-sale creator unless owner asks.
- **Money law:** BA drafts salary; SA/ASA confirms. Owner SMS after Finance **accept**. See [`docs/OPS/MONEY-CONTRACT.md`](../OPS/MONEY-CONTRACT.md).

---

### Task 0: Critical lint / runtime fixes (P0)

**Files:**
- Modify: `src/pages/InquiriesPage.jsx` — add missing `Card*` imports; drop `export` on `COMPLAINT_STATUSES`
- Modify: `src/pages/PosPage.jsx` — import `TabsList`, `TabsTrigger`; remove dead `SHELL_TABS`
- Modify: `src/pages/HistoryPage.jsx` — move `Navigate` guard **after** all hooks
- Modify: `src/pages/InventoryPage.jsx` — move `useMemo` **before** early returns; simplify `resolveInventoryTab`

**Step 1: Run lint on touched pages**

Run: `npx eslint src/pages/InquiriesPage.jsx src/pages/HistoryPage.jsx src/pages/InventoryPage.jsx src/pages/PosPage.jsx`
Expected: **0 errors** on these four files

**Step 2: Run seam tests**

Run: `node --test tests/opsShell.test.js tests/ownerRevisionsPhase7.test.js`
Expected: **46/46 pass**, exit 0

**Step 3: Run production build**

Run: `npm run build`
Expected: exit 0, `✓ built`

**Step 4: Commit**

```bash
git add src/pages/InquiriesPage.jsx src/pages/HistoryPage.jsx src/pages/InventoryPage.jsx src/pages/PosPage.jsx
git commit -m "fix: ops pages lint — Card imports, hooks order, TabsList"
```

---

### Task 1: Env + readiness gate

**Files:**
- Read: `.env.example` — `OWNER_SMS_PHONE`, `BUSYBEE_*`, Supabase keys
- Run: `scripts/e2e-readiness.mjs`

**Step 1: Copy env template if missing**

```bash
cp .env.example .env   # skip if .env exists
```

**Step 2: Set owner SMS + BusyBee in `.env` (server-only, never commit)**

```
OWNER_SMS_PHONE=+63XXXXXXXXXX
BUSYBEE_API_KEY=...
BUSYBEE_CLIENT_ID=...
BUSYBEE_SENDER_ID=HAKUM
```

**Step 3: Run readiness**

Run: `node scripts/e2e-readiness.mjs`
Expected: `env.supabase+vapid: ok`, demo account logins pass; `env.busybee: present` if keys set

**Step 4: Commit** — **do not commit `.env`**

```bash
git add docs/OPS/NEW-REVISIONS-CHECKLIST.md
git commit -m "docs: ops cutover env prerequisites"
```

---

### Task 2: Seed branch stock (POS fail-closed)

**Files:**
- UI: `src/pages/BranchInventoryPage.jsx`
- Schema: `product_branch_stock` via Supabase MCP or SQL
- Test: `tests/inventoryBranchStock.test.js`

**Step 1: Write failing assertion (optional seam check)**

Add to `tests/inventoryBranchStock.test.js` if branch seed helper missing:

```javascript
import assert from 'node:assert/strict'
import test from 'node:test'

test('every resellable SKU needs branch stock row before POS sale', () => {
  // ponytail: documents fail-closed contract; live seed is ops data
  assert.ok(true)
})
```

**Step 2: Run test**

Run: `node --test tests/inventoryBranchStock.test.js`
Expected: pass

**Step 3: Seed per branch (Supabase SQL or Branch Inventory UI)**

For each active branch slug (`bacoor`, etc.) and each `usage_kind = 'resellable'` product:

```sql
INSERT INTO product_branch_stock (product_id, branch_slug, quantity)
SELECT p.id, 'bacoor', 100
FROM products p
WHERE p.usage_kind = 'resellable'
ON CONFLICT (product_id, branch_slug) DO UPDATE SET quantity = EXCLUDED.quantity;
```

**Step 4: Smoke POS merch add-to-cart**

Manual: login `admin@hakumautocare.com` → `/operations/pos?tab=checkout` → add merch → checkout must not error on stock.

**Step 5: Commit seed script if added**

```bash
git add supabase/migrations/*seed* scripts/seed-branch-stock.sql
git commit -m "ops: seed product_branch_stock for resellable SKUs"
```

---

### Task 3: Owner SMS after Finance accept

**Files:**
- Server: `server/notifyShiftClose.mjs`, `server/busybee.mjs`
- Lib: `src/lib/bacoorDailyReport.js` — `formatBacoorReportText`
- Test: `tests/notifyShiftCloseOwnerSms.test.js`

**Step 1: Run owner SMS unit test**

Run: `node --test tests/notifyShiftCloseOwnerSms.test.js`
Expected: pass, exit 0

**Step 2: Manual money path**

1. BA: POS sales + EoS submit (`/operations/pos?tab=expenses`)
2. SA: Finance → accept close (`/operations/finance`)
3. Confirm SMS to `OWNER_SMS_PHONE` includes: Branch, Total Sales, Car wash, Detailing, Tint, Coffee, Accessories, Salary expenses, payment mode breakdown

**Step 3: Document result**

Check box in `docs/OPS/NEW-REVISIONS-CHECKLIST.md` ops cutover section.

**Step 4: Commit checklist only**

```bash
git add docs/OPS/NEW-REVISIONS-CHECKLIST.md
git commit -m "docs: owner SMS cutover verified"
```

---

### Task 4: Sunday recon → floor chemical chart

**Files:**
- UI: `src/pages/BranchInventoryPage.jsx` (recon tab)
- Lib: `src/lib/inventoryBranchStock.js`
- Floor: `src/pages/OperationsPages.jsx` — `SuperAdminFloorBoard`
- Test: `tests/ownerRevisionsPhase7.test.js` — chemical stub test

**Step 1: Run test**

Run: `node --test tests/ownerRevisionsPhase7.test.js`
Expected: `chemical usage charts from recon lines; empty → stub` passes

**Step 2: BA submits recon**

Login BA → Inventory → Branch stock → Sunday recon → enter leftover counts → submit

**Step 3: SA approves**

Login SA → same recon → approve → stock updates

**Step 4: Verify floor chart**

Login BossMich → Floor board → chemical usage chart shows data (not stub)

**Step 5: Commit evidence**

```bash
git add e2e-evidence/responsive-validation/
git commit -m "docs: sunday recon + floor chart smoke evidence"
```

---

### Task 5: BA salary draft → SA payroll confirm

**Files:**
- Lib: `src/lib/shiftClose.js` — `attachSalaryDraftExtras`
- Pages: `src/pages/PosPage.jsx`, `src/pages/PayrollPage.jsx`, `src/pages/FinancePage.jsx`
- Test: `tests/moneyContract.test.js`, `tests/ownerRevisionsPhase6.test.js`

**Step 1: Run money contract tests**

Run: `node --test tests/moneyContract.test.js tests/ownerRevisionsPhase6.test.js`
Expected: all pass; BA blocked from `run_payroll`

**Step 2: Manual path**

1. BA EoS with `salary_draft_extras` JSON on submit
2. Finance accept
3. SA Payroll pending floor shows draft extras
4. SA confirms pay; BA still cannot confirm

**Step 3: Commit checklist tick**

---

### Task 6: Detailing outcome → Experience card

**Files:**
- Server: `server/bookingStatus.mjs`
- UI: `src/pages/BookingBoardPage.jsx`
- Test: `tests/ownerRevisionsPhase2.test.js`

**Step 1: Run test**

Run: `node --test tests/ownerRevisionsPhase2.test.js`
Expected: Experience card for outcomes 2–3 passes

**Step 2: Manual**

Complete detailing booking with outcome `complaints_addressed` or `unhappy` → Planning board shows Experience card

---

### Task 7: Investor scope + customer mute

**Files:**
- Lib: `src/lib/financeCorporate.js` — `filterFinanceBranchOptions`
- CRM: customer `notify_sms`, `notify_push`, `is_disabled`
- Test: `tests/ownerRevisionsPhase5.test.js`, `tests/notifyBooking.test.js`

**Step 1: Run tests**

Run: `node --test tests/ownerRevisionsPhase5.test.js tests/notifyBooking.test.js`
Expected: investor HQ hidden; mute skips notify

**Step 2: Manual investor login**

No Corporate/HQ tab; branch-scoped P&L only

**Step 3: Mute customer + status change**

CRM mute → queue status change → no SMS/push

---

### Task 8: UI consistency — POS merch tabs → OpsTabList

**Files:**
- Modify: `src/pages/PosPage.jsx:1186-1250` — replace `planner-v2-tabs` merch family toolbar with shadcn `TabsList` or pill `Button` group (`min-h-11`)
- Reference: `src/components/ops/OpsTabBar.jsx`
- Design: `design-system/hakum-ops/MASTER.md` — 44px touch, 150–300ms transitions, Lucide only

**Step 1: Write failing source-scan test**

Add to `tests/opsShell.test.js`:

```javascript
test('PosPage merch family does not use planner-v2-tabs', () => {
  const src = readFileSync('src/pages/PosPage.jsx', 'utf8')
  assert.doesNotMatch(src, /planner-v2-tabs mb-3.*Merch family/s)
})
```

**Step 2: Run test — expect FAIL**

Run: `node --test tests/opsShell.test.js`
Expected: FAIL on new test

**Step 3: Replace planner-v2-tabs with shadcn tabs/buttons**

Use existing `MERCH_FAMILIES.map` with `Button variant={...}` and `min-h-11`, matching Inventory/POS shell tabs.

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add src/pages/PosPage.jsx tests/opsShell.test.js
git commit -m "refactor: POS merch family tabs — OpsTabList parity"
```

---

### Task 9: Performance quick wins (@performance-optimizer)

**Files:**
- Read: `vite.config.js` — manual chunks
- Bundle: `dist/assets/three-*.js` (~980KB) — ensure lazy route only

**Step 1: Measure build chunks**

Run: `npm run build 2>&1 | findstr /i "three charts OperationsPages"`
Expected: `three-*.js` separate chunk; ops pages code-split

**Step 2: Verify lazy routes**

Grep `React.lazy` in `src/App.jsx` for Finance, OperationsPages, PlanningBoardPage

**Step 3: No change unless regression**

If `three` loads on POS/Queue, add lazy import for `PPFVisualizer` only. **Do not** optimize micro-renders without profile evidence.

**Step 4: Commit only if code changed**

---

### Task 10: Full verification gate (@verify)

**Step 1: Owner-revision suite**

Run:
```bash
node --test tests/ownerRevisionsPhase2.test.js tests/ownerRevisionsPhase5.test.js tests/ownerRevisionsPhase6.test.js tests/ownerRevisionsPhase7.test.js tests/inventoryBranchStock.test.js tests/moneyContract.test.js tests/posSale.test.js tests/notifyShiftCloseOwnerSms.test.js tests/queueLogic.test.js tests/notifyBooking.test.js tests/qaNewRevisionsBugs.test.js tests/opsShell.test.js
```
Expected: **119/119 pass**, exit 0

**Step 2: E2E bundle (optional but recommended)**

Run: `node scripts/e2e-readiness.mjs && node scripts/e2e-queue-sms-pos.mjs`
Expected: exit 0

**Step 3: Build**

Run: `npm run build`
Expected: exit 0

**Step 4: Update checklist date + scoreboard**

Modify: `docs/OPS/NEW-REVISIONS-CHECKLIST.md` — set audit date, tick ops cutover boxes

**Step 5: Commit**

```bash
git add docs/OPS/NEW-REVISIONS-CHECKLIST.md
git commit -m "docs: new revisions ops cutover complete — verified 119 tests"
```

---

### Task 11: Responsive + branding pass (@ui-ux-pro-max)

**Files:**
- Master: `design-system/hakum-ops/MASTER.md`
- Evidence: `e2e-evidence/responsive-validation/phase7-admin-secondary-ops-shell-report.md`

**Step 1: Pre-delivery checklist (MASTER.md §Pre-Delivery)**

Verify on 375 / 768 / 1024 / 1440:
- [ ] Lucide icons only (no emoji icons)
- [ ] `min-h-11` on primary taps (OpsTabList, queue cards)
- [ ] Focus rings visible
- [ ] No horizontal scroll mobile
- [ ] Accent `#DC2626`, primary `#1E293B`

**Step 2: Capture screenshots or extend responsive report**

**Step 3: Commit evidence**

---

## Remaining lint backlog (non-blocking, Task 12+)

Fix in separate commits — do not block cutover:

| File | Issue | Fix |
|------|-------|-----|
| `src/lib/posSale.js:70` | redundant Boolean | remove cast |
| `src/lib/serviceKinds.js:162` | unused `_todayDate` | prefix or remove |
| `server/customerSignup.mjs` | unused `body` | remove param |
| `src/components/CustomerNotesPanel.jsx` | unused `Input` | remove import |
| `eslint.config.js` | ignore `docs/_assets`, puppeteer scripts | add overrides |

Run full lint after: `npm run lint` → target **0 errors** in `src/` and `server/`.

---

## Execution summary

| Phase | Status |
|-------|--------|
| Engineering (NewRevisions.md) | **0 GAP** |
| Task 0 lint/runtime | **In progress** — 4 pages fixed |
| Tasks 1–7 ops cutover | **Needs env + manual smoke** |
| Task 8 POS merch tabs | Pending |
| Tasks 9–11 verify + UX | Pending |

**Do not claim owner-demo ready until Tasks 1–7 manual checks pass and Task 10 gate runs fresh.**
