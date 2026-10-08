# Revision Checklist — Hakum Auto Care

Run this before declaring any work unit done. Each line is a command with a
stated result. **Do not write "should", "probably" or "likely"** — either a
command passed and you paste the number, or the item is `NOT VERIFIED` with the
reason it could not be run.

## 1. Fast gates (every change)

| # | Command | Expected | Result |
|---|---------|----------|--------|
| 1.1 | `npm test` | all pass, exit 0 | |
| 1.2 | `npx eslint .` | exit 0 | |
| 1.3 | `npm run build` | exit 0 | |

## 2. Contract checks (when authz, money, or a role changes)

| # | Command | Covers | Result |
|---|---------|--------|--------|
| 2.1 | `node --test tests/permissions.test.js` | RBAC matrix, nav never links a forbidden page | |
| 2.2 | `node --test tests/authzMoneyGates.test.js` | client↔SQL grant parity; Books entry, For Payment lane, KPI scope, data centre, audit | |
| 2.3 | `node --test tests/bookingStatusRoles.test.js` | every role × every status on `/api/booking-status` | |
| 2.4 | `node --test tests/bookingStatusTransitions.test.js` | the status ladder + SA bypass | |
| 2.5 | `node --test tests/roleGuideParity.test.js` | role guides match what the docks actually show | |
| 2.6 | `node --test tests/roleQaHarness.test.js` | the QA harness's own personas still match the gates | |

## 3. Money path (only when POS / Daily Sheet / Finance changes)

The money path is **POS sale → Daily Sheet → Finance approve → books**. End of
Shift, Payroll and My Pay were retired 2026-10-01 and must not come back.

| # | Command | Covers | Result |
|---|---------|--------|--------|
| 3.1 | `node --test tests/dailySheet.test.js` | sheet formulas, minor units | |
| 3.2 | `node --test tests/moneyContract.test.js` | BA submits, cannot approve or edit books | |
| 3.3 | `node --test tests/posSale.test.js` | sale integrity | |
| 3.4 | `PGLITE_DIR="%TEMP%\hakum-pglite" node scripts/_daily-sheet-sql-check.mjs` | the real SQL: branch scope, approve-once, reopen, revoked payroll | |
| 3.5 | `npm run e2e:daily-sheet-money` | the money path against a live server | |
| 3.6 | `npm run e2e:ui-money` | the money path through the UI | |

> 3.4 needs PGlite installed outside the repo:
> `npm i @electric-sql/pglite --prefix "%TEMP%\hakum-pglite"`. Without it this
> line is `NOT VERIFIED (pglite missing)` — and that is exactly why the shipped
> money SQL is currently unverified in the default suite.

## 4. Browser / multi-role (when a page, route, or role changes)

| # | Command | Covers | Result |
|---|---------|--------|--------|
| 4.1 | `npm run e2e:role-qa` | the maintained multi-role pack: login, landing, dock walk, deny, console errors, money gates, retired redirects | |
| 4.2 | `npm run e2e:nav-walk` | every nav link resolves | |
| 4.3 | `npm run e2e:responsive` | layout across viewports | |
| 4.4 | `npm run test:browser` | `*.browser.test.js` against a preview build | |

## 5. Public surface (when metadata, NAP, or public copy changes)

| # | Command | Covers | Result |
|---|---------|--------|--------|
| 5.1 | `node --test tests/publicMeta.test.js` | titles, canonical, robots, JSON-LD, NAP | |

## 6. Evidence discipline

- Every check above leaves evidence in `e2e-evidence/<pack>/` (PNG per
  assertion + `summary.json`). A green claim with no evidence file is
  `NOT VERIFIED`.
- `summary.json` must have `"ok": true` and `passed === total`. A run that
  exits non-zero is a finding, not a nuisance — file it in `BUGS.md`.
- New defects go in `BUGS.md` with severity, the command that reproduces them,
  and the commit that closed them.

## 7. Definition of done

A work unit is done when:

1. §1 is green.
2. Every §2/§3/§4/§5 line that applies to the change has a **pasted number**, or
   is marked `NOT VERIFIED` with a reason.
3. Any defect found is in `BUGS.md` with a reproducing command.
4. Any fix has been **revert-proven**: revert it, watch the check fail, restore
   it, watch the check pass. A fix never demonstrated failing is not proven.
5. Nothing is pushed. Commits are local until the owner says otherwise.