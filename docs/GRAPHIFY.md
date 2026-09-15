# Graphify — Hakum knowledge graph

Persistent memory for this repo. Built 2026-09-15 from code AST + all product markdown + live schema dump (`docs/GRAPHIFY_MEMORY.md`).

## Use it (agents and humans)

```powershell
$env:PATH = "C:\Users\jcuad\.local\bin;$env:PATH"
graphify query "How do Queue and Bookings differ?"
graphify path "complete_pos_sale" "run_payroll"
graphify explain "serviceKindFromPayCategory"
graphify update .          # after code edits (AST only)
```

- Interactive map: `graphify-out/graph.html`
- Agent wiki: `graphify-out/wiki/index.md`
- Report: `graphify-out/GRAPH_REPORT.md`
- Cursor always-on rule: `.cursor/rules/graphify.mdc`

Git hook rebuilds the AST graph on commit (`graphify hook status`).

## What was ingested

- Code: `src/`, `server/`, `supabase/migrations/`, `tests/`, `scripts/`, `api/`
- Docs: `docs/**`, `CONTEXT.md`, `CHANGELOG.md`, `audit/`, `audits/`, root product markdown
- Live DB facts: `docs/GRAPHIFY_MEMORY.md` (tables, RPCs, RLS, catalog, sizes, money path)
- Workflows/enums/API: `docs/GRAPHIFY_WORKFLOWS.md` (status ladders, CHECKs, `/api/*`, storage)
- Columns + policy names: `docs/GRAPHIFY_DB_DETAIL.md`

Excluded on purpose: `public/` images, Brand Assets, e2e screenshots, `tmp-*`, secrets (`.env*`).

## Install (this machine)

```powershell
uv tool install "graphifyy[sql,postgres,pdf]"
graphify cursor install
graphify install --project
```

CLI is `graphify`; PyPI package is `graphifyy`. Put `C:\Users\jcuad\.local\bin` on PATH.
