# Project Status

**Last Updated:** 2026-09-07 (Asia/Manila)  
**Current Branch:** main  
**Current Commit:** `27fd7f4` (pulled) + **local fixes uncommitted** (Windows BreDESIGN browser harness)

## Executive Summary

Pulled **BreDESIGN public rebuild** (`27fd7f4`, PR #8). Production **build PASS**. Full suite **1194/1194 PASS** with preview on `:4173` after fixing Mac-only Chrome paths and OS `prefers-reduced-motion` pollution in browser tests.

Customer PWA redesign remains on `main` (prior `8bad996`). Remaining product polish/doc/theme/ops cutover items from the prior PO audit still apply.

## Tech Stack

- **Frontend:** Vite + React  
- **Backend/Data:** Supabase + Vercel API  
- **Testing:** Node `node:test` + Puppeteer (unit runner includes `*.browser.test.js` — needs `vite preview` on `:4173`)

## Testing (this session — 2026-09-07)

| Claim | Command | Result |
|---|---|---|
| Pull | `git pull --ff-only origin main` | **PASS** · `8bad996` → `27fd7f4` |
| Production build | `npm run build` | **PASS** · exit 0 |
| Unit + browser suite | `npm test` (preview `:4173`) | **PASS** · **1194/1194** · exit 0 |
| Full readiness orch | `npm run test:readiness` | **NOT RE-RUN** this session |

## Local fixes after pull (uncommitted)

1. `tests/puppeteerLaunch.js` — cross-platform Chrome + emulate `prefers-reduced-motion: no-preference`
2. BreDESIGN / service-detail browser tests use that helper (was hardcoding macOS Chrome path)
3. Mobile PPF hero CSS: `justify-content:center` (aligned with BreDESIGN intent; reduced-motion was the real centering failure on this host)

## Feature Status (unchanged high-level)

| Feature | Status |
|---|---|
| Ops NewRevisions | COMPLETE (ops cutover residuals remain) |
| Customer portal redesign | COMPLETE (doc/theme policy drift remains) |
| Public BreDESIGN marketing | LIVE on `main` (`27fd7f4`) |
| BUG-007 money→payroll browser E2E | NEEDS VERIFICATION |
| Production SMS / OWNER_SMS / chem recon | PARTIAL (ops) |

## Recommended Next Action

**Commit + push** the Windows browser-harness fixes, then either (A) lock customer theme + reconcile docs, or (C) ops cutover / BUG-007 proof.

## Git State

```text
Branch: main @ 27fd7f4 + local test/CSS fixes
Untracked noise: Brand Assets/, skill md, tmp-* — do not commit without intent
```
