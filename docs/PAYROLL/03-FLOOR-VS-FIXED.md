# 03 — Floor vs Fixed tracks

## Why two tracks

Hakum pays **bay labor** from live POS wash-eligible sales, and **salaried / package** people on a separate company track. Mixing them in one confirm would blur proof and books.

| | Floor | Fixed |
|--|-------|-------|
| `run_kind` | `floor` | `fixed` |
| Wizard | Period → POS proof → lines → confirm | Period → people → commissions/adjust → review |
| Inputs | Paid sales, attendance, ceramic expense keys, optional CA deduct | `staff_pay_packages` only |
| Branch | Bay slug required | Often `null` / books under `hq` |
| Notes prefix | Floor pay | Fixed salary |

## Floor (crew + TL)

1. SA/ASA picks period (or starts from pending accumulated days).
2. `loadProof` loads paid sales, attendance, ceramic expenses, claimed sale ids.
3. `buildPayrollPreview({ runKind: 'floor' })` builds wash pool lines + ceramic splits.
4. Manual adjustments/commissions allowed in wizard.
5. Confirm → `run_payroll` claims sales so they cannot be paid twice.

TL is **not** a separate engine: if clocked present/late, they share the wash pool like crew (unless owner later defines a TL-only package).

## Fixed (packages)

1. Active `staff_pay_packages` with `amount_minor` = monthly salary.
2. `prorateMonthlyPackageMinor` by frequency (monthly, semimonthly, weekly, …).
3. `package_kind` hybrid vs fixed is mostly labeling — **math is the same proration** today.
4. No POS sales required.

## Overlap rules

- Same calendar window can have one floor run (per bay) and one fixed run.
- Sale uniqueness is global: a sale claimed on any floor run cannot be claimed again.
- Fixed runs do not clear pending floor days (pending uses `isFloorPayrollRun`).

## Wrong-kind risk

One “Run payroll” tab + kind toggle — easy to run fixed when intending floor. Training + History badges (“Floor” / “Fixed”) mitigate; UI still allows mistakes.
