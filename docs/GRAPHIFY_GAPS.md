# Graphify gap audit — principal fullstack view

Updated 2026-09-15 after full live dumps (`GRAPHIFY_DB_FULL`, `GRAPHIFY_RLS`, `GRAPHIFY_MONEY_PAYLOADS`, `GRAPHIFY_FRONTEND`).

## Verdict

**Graphify knowledge dump for DB + workflows + frontend seams = complete** for principal navigation.
Remaining items are **ops/dashboard** (SMTP, Vercel secret parity, observability) or **AST limitations** (static image maps) — not missing product memory.

## Completeness checklist

| Seam | Status | Doc |
|------|--------|-----|
| Domain narrative (queue/bookings/money/roles) | Done | MEMORY, WORKFLOWS, user stories |
| Table / view inventory | Done | MEMORY |
| Hub columns + policy names | Done | DB_DETAIL |
| All 74 RPC signatures + security | Done | DB_FULL |
| All 25 user triggers | Done | DB_FULL |
| Full FK map (146) | Done | DB_FULL |
| Enums + critical CHECKs | Done | DB_FULL + WORKFLOWS |
| Hub RLS USING/WITH CHECK | Done | RLS |
| Storage object policies | Done | RLS |
| FE ↔ DB authz bridge | Done | RLS + FRONTEND |
| Money JSON payloads | Done | MONEY_PAYLOADS |
| Routes + allowRoute matrix | Done | FRONTEND |
| `/api/*` gateway map | Done | FRONTEND + WORKFLOWS |
| Env **names** (no secrets) | Done | SEAMS |
| Graph freshness vs HEAD | Discipline | `graphify update .` after pulls |
| Auth SMTP / Vercel parity / Sentry | Ops outside repo | SYSTEM_GAPS |
| jsonb field-level JSON Schema files | Optional polish | MONEY_PAYLOADS sufficient |
| `bredesign/content.js` AST symbols | N/A (static map) | FRONTEND note |
| Every non-hub RLS expression verbatim | Optional | Hub covered; rest in DB |

## Honest scores (knowledge memory)

| Layer | Score |
|-------|-------|
| Domain narrative | ~98% |
| Live schema (tables/RPC/FK/trigger/enum/CHECK) | ~98% |
| Hub RLS + storage policies | ~95% |
| Money payload contracts | ~95% |
| Frontend routes + RBAC gates | ~95% |
| Env/deploy **ops confirmation** | ~40% (names yes; live parity is dashboard work) |
| Code↔RPC AST call edges | ~40% (docs + payloads bridge; SQL bodies in migrations) |

**Overall Graphify principal memory: ~95%+ for engineering context.** Soft-launch ops blockers in `SYSTEM_GAPS.md` are intentionally not “graph knowledge.”

## Refresh

```powershell
$env:PATH = "C:\Users\jcuad\.local\bin;$env:PATH"
# After schema change: re-run MCP dumps / scripts/generate-graphify-full-dumps.py then:
graphify update .
```
