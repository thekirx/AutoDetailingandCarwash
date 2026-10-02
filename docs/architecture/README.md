# Architecture diagrams (Archify)

Showcase HTML + JSON specs for Hakum principal paths live here.

## Tooling

Global skill: `~/.agents/skills/archify` (Cursor/Claude junctions under `~/.cursor/skills/archify`).

```powershell
$archify = "$env:USERPROFILE\.agents\skills\archify\bin\archify.mjs"
node $archify doctor
node $archify validate workflow .\docs\architecture\<name>.workflow.json --quality showcase --json
node $archify deliver workflow .\docs\architecture\<name>.workflow.json .\docs\architecture\<name>.workflow.html --quality showcase --json
node $archify visual-check .\docs\architecture\<name>.workflow.html --json
```

## Conventions

- Ground nodes in `graphify query` / live code — not invented RPCs.
- Prefer one main path, ≤12 primary nodes, `meta.quality_profile: "showcase"`.
- Keep production SMS/SMTP ops blockers out of “closed” diagrams unless host-proven.

## Priority maps

| Concern | Type | Artifact |
|---------|------|----------|
| **Full shop-day lifecycle (all roles)** | `workflow` | [`shop-day-flops.workflow.html`](./shop-day-flops.workflow.html) · [spec](./shop-day-flops.workflow.json) |
| **Daily Sheet money path** | `workflow` | [`daily-sheet.workflow.html`](./daily-sheet.workflow.html) · [spec](./daily-sheet.workflow.json) |
| **Daily Sheet statuses** | `lifecycle` | [`daily-sheet.lifecycle.html`](./daily-sheet.lifecycle.html) · [spec](./daily-sheet.lifecycle.json) |
| Money triangle detail | `workflow` / `dataflow` | create on demand → `money-path` |
| Queue statuses | `lifecycle` | create on demand → `queue-status` |
| Daily Sheet reopen | `sequence` | create on demand → `daily-sheet-reopen` |

End of shift + Floor payroll were retired on 2026-10-01 (see [`docs/daily-sheet/README.md`](../daily-sheet/README.md)); do not draw them as live paths.

Canonical map: Customer · Sales · Crew · TL · Branch Admin · SA/ASA · Investor from book → bay → POS → Daily Sheet → Finance approve → books/P&L. Showcase validate 9/9 + visual-check required after every re-deliver. Do not edit the HTML by hand.
