# Scripts Customer Regression Check Mjs

> 10 nodes · cohesion 0.42

## Key Concepts

- **session.js** (10 connections) — `src/lib/session.js`
- **session.test.js** (9 connections) — `tests/session.test.js`
- **ensureFreshAccessToken()** (6 connections) — `src/lib/session.js`
- **needsRefresh()** (4 connections) — `src/lib/session.js`
- **sessionExpiresAtMs()** (4 connections) — `src/lib/session.js`
- **isSessionExpired()** (3 connections) — `src/lib/session.js`
- **refreshSessionSingleFlight()** (3 connections) — `src/lib/session.js`
- **shouldReloadProfile()** (3 connections) — `src/lib/session.js`
- **getSession()** (1 connections) — `tests/session.test.js`
- **refreshSession()** (1 connections) — `tests/session.test.js`

## Relationships

- [Src Appx](Src_Appx.md) (4 shared connections)
- [Docs User Stories Pdf](Docs_User_Stories_Pdf.md) (1 shared connections)
- [Src Lib servicePricing](Src_Lib_servicePricing.md) (1 shared connections)

## Source Files

- `src/lib/session.js`
- `tests/session.test.js`

## Audit Trail

- EXTRACTED: 25 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*