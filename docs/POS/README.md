# Hakum POS — documentation index

**Last audited:** 2026-08-22  
**Scope:** Point of Sale (`/operations/pos`), End of shift, POS settings, and how sales/close connect to Payroll and Finance.  
**Tone:** Strict principal audit — what works, what is incomplete, what must not be advertised as finished.

## Start here

| Doc | Purpose |
|-----|---------|
| [00-VERDICT.md](./00-VERDICT.md) | Honest pass/fail for Hakum ops |
| [01-STRUCTURE.md](./01-STRUCTURE.md) | Modules, routes, hottest files |
| [02-DATAFLOW.md](./02-DATAFLOW.md) | Tables, RPCs, write path |
| [03-CHECKOUT-AND-CATALOG.md](./03-CHECKOUT-AND-CATALOG.md) | Services, packages, detailing, merch |
| [04-END-OF-SHIFT.md](./04-END-OF-SHIFT.md) | Baseline truth vs BA attestation |
| [05-PAYROLL-CONNECTION.md](./05-PAYROLL-CONNECTION.md) | What pays people (and what does not) |
| [06-SETTINGS.md](./06-SETTINGS.md) | Configurable vs hardcoded |
| [07-ROLE-WORKFLOWS.md](./07-ROLE-WORKFLOWS.md) | SA / ASA / BA / TL day paths |
| [08-GAPS-AND-RISKS.md](./08-GAPS-AND-RISKS.md) | Weak seams and risks |
| [09-FLOWCHARTS.pdf](./09-FLOWCHARTS.pdf) | **PDF** flowcharts (print/share) |
| [09-FLOWCHARTS.html](./09-FLOWCHARTS.html) | Visual flowcharts (browser) |
| [09-FLOWCHARTS.md](./09-FLOWCHARTS.md) | Flowchart source (Mermaid) |
| [docs/OPS/MONEY-CONTRACT.md](../OPS/MONEY-CONTRACT.md) | Locked POS ↔ Payroll ↔ Finance rules |

## Product contract (locked)

1. **POS** owns day money capture (paid sales, POS expenses, End of shift attestation).
2. **Finance** owns close review and P&L from paid sales/expenses — does **not** rewrite sales.
3. **Payroll** owns period pay from **paid POS proof + attendance** (floor) or packages (fixed). Close acceptance **queues** opportunity; it does **not** invent pay lines from attestation ₱.
4. **Settings** configure policy labels/lists where shipped; they must not fork a second calculation path.

## Quick navigation (code)

| Concern | Path |
|---------|------|
| POS UI | `src/pages/PosPage.jsx` |
| Sale payload / handoff cart | `src/lib/posSale.js` |
| End of shift helpers | `src/lib/shiftClose.js` |
| Daily baseline math | `src/lib/bacoorDailyReport.js` |
| Wizard UI | `src/components/ShiftCloseWizard.jsx` |
| POS settings UI | `src/pages/settings/PosSettingsPage.jsx` |
| POS settings normalize | `src/lib/posSettings.js` |
| Floor payroll preview | `src/lib/payroll.js` |
| Wash pool / ceramic | `src/lib/compensation.js` |
| Sale RPC | `complete_pos_sale` (migrations under `supabase/migrations/`) |
| Close RPC | `submit_shift_close` / `review_shift_close` |

## Related glossary

See root [`CONTEXT.md`](../../CONTEXT.md) — Floor, Handoff, Shop-day settlement, Payroll run, Cash advance.

Payroll deep audit: [`docs/PAYROLL/`](../PAYROLL/README.md).
