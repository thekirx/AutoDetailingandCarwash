# 01 — POS structure (modules & files)

## Route & shell

| Item | Value |
|------|--------|
| Route | `/operations/pos` |
| Gate | `allowRoute(profile, 'pos')` → `canAccessPos` |
| Page | `src/pages/PosPage.jsx` |
| Settings | `/operations/settings/pos` → `PosSettingsPage.jsx` |

## Shell tabs (`SHELL_TABS`)

| Id | UI label (approx) | Job |
|----|-------------------|-----|
| `checkout` | Sell | Catalog + cart entry |
| `pending` | Pay queue | Pending `pos_handoffs` |
| `expenses` | Expenses | Day expense drafts |
| `dashboard` | Today | Summary tiles |

Query `?tab=` must be one of the shell ids above.

## Catalog tabs (Sell only; not shell)

| Id | Contents | Who sees |
|----|----------|----------|
| `bay` | Services & packages (`filterPosBayCatalog`) | SA / ASA(pos) |
| `detailing` | Detailing catalog (`filterPosDetailingCatalog`) | SA / ASA(pos) |
| `merch` | Products | BA **only** this tab; SA/ASA all three |

BA force: `useEffect` sets `tab = 'merch'` whenever `branchAdmin`.

## Module map

```text
PosPage.jsx                          orchestration / UI
  ├─ posSale.js                      handoff cart, payload, expense close filter
  ├─ posSettings.js                  normalize payment/expense lists
  ├─ posSellables.js                 merch tags, sale buckets for report
  ├─ serviceKinds.js                 bay vs detailing catalog split
  ├─ servicePricing.js               optional size prices
  ├─ compensation.js                 ceramic preview / drafts
  ├─ bacoorDailyReport.js            EoS baseline from paid sales
  ├─ shiftClose.js                   keys, validation, submit helpers
  └─ ShiftCloseWizard.jsx            multi-step EoS UI

complete_pos_sale (Postgres RPC)     authoritative write
submit_shift_close (Postgres RPC)    attestation write
review_shift_close (Postgres RPC)    Finance accept/reject/lock
```

## Hottest files (audit order)

1. `src/pages/PosPage.jsx` — god page (~1.7k lines)
2. `src/lib/posSale.js` — checkout seam
3. `src/lib/bacoorDailyReport.js` + `src/lib/shiftClose.js` — EoS
4. `src/components/ShiftCloseWizard.jsx`
5. `src/lib/posSellables.js` + `src/lib/serviceKinds.js`
6. `src/lib/compensation.js`
7. `src/pages/settings/PosSettingsPage.jsx` + `src/lib/posSettings.js`
8. `src/lib/payroll.js` — consumer of sales (not close ₱)
9. `src/auth/permissions.js` — BA/SA/ASA gates
10. Latest `complete_pos_sale` / `submit_shift_close` migrations

## Tests that lock seams

| Test file | Covers |
|-----------|--------|
| `tests/posWorkflowSeam.test.js` | Handoff, package normalize, Pay queue UX, EoS expense filter |
| `tests/posSale.test.js` | Payload / membership pricing |
| `tests/posPayrollSettings.test.js` | Settings normalize + routes |
| `tests/shiftClose.test.js` | Close validation / keys |
| `tests/payrollPendingFloor.test.js` | Pending vs claimed sales |

## Architecture note (depth)

`PosPage.jsx` is **shallow orchestration with deep UI** — most bugs live in wiring (catalog `item_type`, tab ids, expense status). Deepening opportunity: concentrate cart build + checkout in `posSale.js` (already partially done via `normalizePosLineItemType` / `buildPosSalePayload`). Deletion test: removing ad-hoc `item_type` branches into one normalizer **concentrates** complexity — yes.
