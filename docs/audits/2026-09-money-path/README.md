# Money path principal audit — 2026-09

Campaign: POS → Finance → Payroll honesty, FE/BE maps, design critique, P0/P1 fixes, Xero-like Finance polish.

**Binding contract:** [`docs/OPS/MONEY-CONTRACT.md`](../../OPS/MONEY-CONTRACT.md)

## Pointer

**Current wave:** COMPLETE — see [PROGRESS.md](./PROGRESS.md)  
**Verdict:** **DONE 100%** · **READY_WITH_OPS_BLOCKERS** (SMS env)

## Pack

| File | Purpose |
|------|---------|
| [FE-MAP.md](./FE-MAP.md) | UI surfaces, tabs, CTAs |
| [BE-MAP.md](./BE-MAP.md) | RPCs, tables, trust boundary |
| [WORKFLOWS.md](./WORKFLOWS.md) | Cashier → EoS → accept → payroll → P&L |
| [HONESTY.md](./HONESTY.md) | Claim vs contract |
| [DESIGN-CRITIQUE.md](./DESIGN-CRITIQUE.md) | Dashboard / web guidelines / UI |
| [find-bugs.md](./find-bugs.md) | Security & logic findings |
| [PROGRESS.md](./PROGRESS.md) | Per-wave log |

## Evidence

`e2e-evidence/money-path/` · `npm run e2e:money-path` · also `e2e:ui-money`
