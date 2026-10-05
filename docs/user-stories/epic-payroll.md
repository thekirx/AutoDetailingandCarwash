# Epic: Crew pay (was floor payroll)

> **Superseded 2026-10-01.** Floor payroll confirm, My Pay, and End-of-shift salary cells are retired.  
> Crew are paid when the **Daily Sheet is approved**. Guide: [`docs/daily-sheet/README.md`](../daily-sheet/README.md).

**Goal:** Suggested pay from attendance + rules; BA adjusts with reason; SA/ASA approval posts pay.

## US-PAY-01 · Suggested pay on the Daily Sheet

**As** Branch Admin  
**I want** suggested crew amounts on today's sheet  
**So that** I can pay fairly without inventing numbers  

**Acceptance**

- [x] Suggestions from attendance + compensation settings
- [x] Override requires a short reason
- [x] Approve posts salary lines as paid expenses

**Test seam:** `src/lib/dailySheet.js`, `e2e:daily-sheet-money`, `tests/dailySheet.test.js`

---

## US-PAY-02 · Crew visibility

**As** crew / detailer  
**I want** to see that pay is settled on the Daily Sheet  
**So that** I do not expect a separate My Pay wizard  

**Acceptance**

- [x] Crew UI copy: pay settled on Daily Sheet / estimate-only where shown
- [x] No My Pay route in current nav for soft-launch roles

**Test seam:** `tests/userStoriesCoverage.test.js` (US-PAY-03)

---

## US-PAY-03 · Settings

**As** Super Admin  
**I want** pay rules under Settings → Daily sheet  
**So that** suggestions stay consistent  

**Test seam:** `tests/userStoriesCoverage.test.js` (US-PAY-03)

---

## Historical (retired)

`run_payroll`, pending floor, and My Pay flows remain in `docs/PAYROLL/` as archive only.
