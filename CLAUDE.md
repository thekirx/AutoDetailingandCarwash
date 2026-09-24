## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Archify (principal diagrams)

Validated architecture / workflow / sequence / dataflow / lifecycle diagrams use the global **archify** skill (`~/.agents/skills/archify`, also linked under `~/.cursor/skills/archify`).

Rules:
- Pair with graphify: evidence first, then Archify JSON → `validate` → `deliver` → `visual-check`.
- Put specs + HTML under `docs/architecture/`.
- Default showcase quality; do not claim deliver success on non-zero exit.
- Principal full-stack sessions also follow `principal-fullstack-workflow` + finish-goal (no fake-ready).
- **SMS policy:** BusyBee outbound **customer reminders/status only** — no inbound replies, **no owner daily SMS** (Finance accept → web push). Do not treat `OWNER_SMS_PHONE` as a readiness gate.
- Optional exploratory browser agent: `docs/qa/JEV-BROWSER-AGENT.md` (`~/tools/jev-ultrafast`) — not a substitute for Puppeteer FLOPS/money e2e.
- CLI: `node %USERPROFILE%\.agents\skills\archify\bin\archify.mjs doctor`
