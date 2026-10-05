# Epic: Branch Admin persona

**Goal:** One bay’s money day — POS, Daily Sheet, attendance, planner — without network People/Finance write.

**Home:** `/operations/pos`

## US-BA-01 · Command chrome = allowRoute

**As** Branch Admin  
**I want** only BA route keys  
**So that** Command never links a page I cannot open  

**Acceptance**

- [x] Home → `/operations/pos`
- [x] Allowed: dashboard, bookings, attendance, pos, inventory, reviews, planning, roadmap, history, audit
- [x] Queue: **denied** (Team Lead / SA / ASA / Ops Lead only)
- [x] Denied: finance hub, CRM, people, console, Cars, Data Center, My Pay (retired)

**Test seam:** `tests/adminScope.test.js`, `e2e:role-qa`, `e2e:nav-walk`

---

## US-BA-02 · Checkout → Daily Sheet

**As** Branch Admin  
**I want** POS + Daily Sheet  
**So that** paid POS is closed that night  

**Acceptance**

- [x] POS tabs include Today + Daily sheet (not End of shift)
- [x] Submit Daily Sheet; cannot approve own sheet
- [x] After SA/ASA approve — release pay

**Test seam:** `e2e:daily-sheet-money`, `e2e:ui-money`, `supabase/tests/daily_flow_role_probe.sql`

---

## US-BA-03 · Crew pay suggestions

**As** Branch Admin  
**I want** suggested pay on the sheet  
**So that** I adjust with a reason before submit  

**Acceptance**

- [x] Suggestions from attendance + compensation settings
- [x] Override requires reason

**Test seam:** `tests/dailySheet.test.js`, `docs/daily-sheet/README.md`
