# ASA — open / deferred defects — 2026-08-01

CRITICAL/HIGH from [`../../asa-deep/02-defects-and-fixes.md`](../../asa-deep/02-defects-and-fixes.md) **Fixed**. Open residuals:

| ID | Sev | Status | Summary | Action |
|----|-----|--------|---------|--------|
| ASA-M1 | MED | Deferred/OPEN | Expenses RLS still admin-style; ignores `finance_write` | Align RLS with grant |
| ASA-M2 | MED | Deferred/OPEN | `complete_pos_sale` ignores `pos` grant | Enforce in RPC |
| ASA-M3 | MED | Documented | CRM/Bookings ungated for ASA | Keep intentional or add grants |
| ASA-P0-1 | P0 | OPEN | pos/finance/reports grants UI-only | Server enforce |
| RPT-P0-1 | P0 | OPEN | Reports silent errors | Surface `.error` |
| OPS-M3 | MED | Deferred | Forgot-password bounce | Product decision |
| DB-P0-1 | P0 | OPEN | Queue UNIQUE / assign RPC | Shared |
| SA-M4/M5 | MED | Deferred | Console Partial shared | Shared with SA |

Grant matrix reference: [`../../asa-deep/01-grant-matrix.md`](../../asa-deep/01-grant-matrix.md).
