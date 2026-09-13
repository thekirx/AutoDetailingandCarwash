# UI consistency — ops + customer (role QA)

Scope: FloorAppShell / Command shell density, docks, toasts; customer `/account/*`. **Not** BreDESIGN `/home`.

## Findings

| ID | Area | Severity | Note | Status |
|----|------|----------|------|--------|
| UI-01 | Floor dock | P2 | TL/Staff/Sales/Marketing/Detailer/Video docks share token density; Keep thumb order ≤5 | OK — match guides |
| UI-02 | Command nav | P2 | BA allowlist matches nav (permissions test locks) | OK |
| UI-03 | Toasts | P2 | Ops destructive actions use shared toast patterns | Log only |
| UI-04 | Customer account | P2 | `CustomerAccountDock` five-tab `capp-dock`; evidence `customer-account.png` | OK Wave E |
| UI-05 | Access denied | P2 | OpsRoleGate → `/operations/access-denied` consistent across persona denies | OK |

## Polish applied this campaign

- Wave A: detailer wash-queue deep-link closed (IA consistency with Bookings home).
- Wave E: account shell reviewed; no P0/P1 control defects; no landing redesign.

## Design kit

Reuse existing ops design tokens / FloorAppShell — no new visual system.
