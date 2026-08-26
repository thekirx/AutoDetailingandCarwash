# Hakum Payroll — documentation index

**Last audited:** 2026-08-22  
**Scope:** Floor pay, fixed salary, pending queue, cash advances, My Pay, settings, and how POS / End of shift connect.  
**Tone:** Strict principal audit — what pays people, what is theater, what must not be advertised.

## Start here

| Doc | Purpose |
|-----|---------|
| [00-VERDICT.md](./00-VERDICT.md) | Honest pass/fail |
| [01-STRUCTURE.md](./01-STRUCTURE.md) | Routes, tabs, hottest files |
| [02-DATAFLOW.md](./02-DATAFLOW.md) | Tables, RPC writes, RLS |
| [03-FLOOR-VS-FIXED.md](./03-FLOOR-VS-FIXED.md) | Dual tracks |
| [04-ENGINE.md](./04-ENGINE.md) | Wash pool, attendance, ceramic, packages |
| [05-PENDING-AND-EOS.md](./05-PENDING-AND-EOS.md) | Pending queue vs close attestation |
| [06-CASH-ADVANCES.md](./06-CASH-ADVANCES.md) | Approve vs auto-deduct truth |
| [07-SETTINGS.md](./07-SETTINGS.md) | Configurable vs hardcoded |
| [08-MY-PAY.md](./08-MY-PAY.md) | Estimate vs posted |
| [09-GAPS-AND-RISKS.md](./09-GAPS-AND-RISKS.md) | Dead flags and weak seams |
| [10-FLOWCHARTS.pdf](./10-FLOWCHARTS.pdf) | **PDF** flowcharts (print/share) |
| [10-FLOWCHARTS.html](./10-FLOWCHARTS.html) | Visual flowcharts (browser) |
| [10-FLOWCHARTS.md](./10-FLOWCHARTS.md) | Flowchart source (Mermaid) |
| [docs/OPS/MONEY-CONTRACT.md](../OPS/MONEY-CONTRACT.md) | Locked POS ↔ Payroll ↔ Finance rules |

## Product contract (locked)

1. **POS** captures day money (paid sales, expenses, End of shift attestation).
2. **Finance** reviews close — does **not** rewrite sales or invent pay.
3. **Payroll** pays from **paid POS proof + attendance** (floor) or **packages** (fixed). Close acceptance **queues** opportunity only.
4. **Cash advances** approve on Payroll; affect close cash; deduct on payroll **only if** settings work end-to-end (today: auto-deduct is broken — see [06-CASH-ADVANCES.md](./06-CASH-ADVANCES.md)).
5. **Settings** configure policy; they must not claim gates they do not enforce.

## Quick navigation (code)

| Concern | Path |
|---------|------|
| Register UI | `src/pages/PayrollPage.jsx` |
| Engine | `src/lib/payroll.js` |
| Pool / ceramic / settings normalize | `src/lib/compensation.js` |
| Confirm RPC | `run_payroll` (migrations under `supabase/migrations/`) |
| CA panel | `src/components/PayrollCashAdvancesPanel.jsx` |
| Settings | `src/pages/settings/PayrollSettingsPage.jsx` |
| My Pay | `src/pages/MyPayPage.jsx` |
| Permissions | `src/auth/permissions.js` — `canAccessPayroll`, `canRunPayroll`, `canViewOwnPay` |

## Related

- POS docs: [`docs/POS/`](../POS/README.md)
- Glossary: [`CONTEXT.md`](../../CONTEXT.md)
