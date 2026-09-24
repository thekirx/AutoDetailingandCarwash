# Admin shop-day friction log

**Decision (2026-09-24):** No POS / Payroll / Finance **redesign** for soft-launch. Log real BA/SA friction here before any UI change. One row per observation; link evidence when possible.

**Money path (do not redesign):** BA POS → End of shift → SA Finance accept → SA Floor payroll. Paid POS = income truth.

## Seeded from FLOPS / audit (not new redesign triggers)

| Date | Role | Page | Friction | Severity | Action |
|------|------|------|----------|----------|--------|
| 2026-09-24 | SA | `/operations/payroll` | Second same-day floor run refused (“Overlapping floor payroll run already exists”) after FLOPS double-sale | Medium | Document honesty; owner void/period policy later — not auto-void |
| 2026-09-24 | SA | Finance Shift reviews | Reopen note must be ≥ 3 chars (DB aligned) | Low | Already fixed; keep in training |
| — | BA | `/operations/pos` | Deferred: receipt/print, void/refund CRUD | P2 product | Out of soft-launch; feature pass later if requested |

## Live shop-day observations (add below)

| Date | Role | Page | Friction | Severity | Action |
|------|------|------|----------|----------|--------|
| | | | | | |

### How to add a row

1. After a real (or staged) shop day, note who hit the pain (BA / SA / ASA / Ops Lead).
2. Name the route (`/operations/pos`, `/operations/finance`, `/operations/payroll`, …).
3. Severity: Blocker / High / Medium / Low.
4. Action: train / copy tweak / scoped feature — **not** “redesign Command shell” unless a single pain is scoped with TDD.

### Redesign gate

Do **not** open a visual rebuild of POS/Payroll/Finance until:

1. BrandTxt office + Vercel Static IPs are live for customer SMS, and  
2. Auth SMTP Gate 10.1 has inbox proof, and  
3. This log has a **repeated Blocker/High** on the same page from real shop days.
