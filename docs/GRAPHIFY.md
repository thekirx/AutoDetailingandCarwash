# Graphify — Hakum knowledge graph

Persistent memory for this repo. Built 2026-09-15 from code AST + product markdown + live schema dumps.

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

## Principal doc index (read in this order)

| Doc | Contents |
|-----|----------|
| `docs/GRAPHIFY_MEMORY.md` | Architecture, domain split, catalog, money path, RBAC narrative, table list |
| `docs/GRAPHIFY_WORKFLOWS.md` | Status ladders, CHECKs, `/api/*`, storage overview |
| `docs/GRAPHIFY_DB_DETAIL.md` | Hub columns + policy **names** |
| `docs/GRAPHIFY_DB_FULL.md` | **All 74 RPCs + args**, 25 triggers, enums, FK map, CHECK highlights |
| `docs/GRAPHIFY_RLS.md` | Hub RLS USING/WITH CHECK gist + storage policies + FE↔DB authz bridge |
| `docs/GRAPHIFY_MONEY_PAYLOADS.md` | `complete_pos_sale` / EoS / `run_payroll` JSON shapes |
| `docs/GRAPHIFY_FRONTEND.md` | Routes, `allowRoute` matrix, API gateway, Detailer/Queue note |
| `docs/GRAPHIFY_SEAMS.md` | Env names, money signatures quick ref, hub FK |
| `docs/GRAPHIFY_GAPS.md` | Completeness score + remaining ops-only items |

Excluded on purpose: `public/` images, Brand Assets, e2e screenshots, `tmp-*`, secrets (`.env*` values).

## What was ingested into the graph

- Code: `src/`, `server/`, `supabase/migrations/`, `tests/`, `scripts/`, `api/`
- Docs: `docs/**`, `CONTEXT.md`, `CHANGELOG.md`, `audit/`, `audits/`, root product markdown
- Live dumps above (re-query MCP when schema changes; regenerate via `scripts/generate-graphify-full-dumps.py` for RPC/trigger scaffolding)

## Install (this machine)

```powershell
uv tool install "graphifyy[sql,postgres,pdf]"
graphify cursor install
graphify install --project
```

CLI is `graphify`; PyPI package is `graphifyy`. Put `C:\Users\jcuad\.local\bin` on PATH.
