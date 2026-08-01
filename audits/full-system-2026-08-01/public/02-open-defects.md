# Public — open / deferred defects — 2026-08-01

| ID | Sev | Status | Summary | Action |
|----|-----|--------|---------|--------|
| CUST-H9 | HIGH | Deferred | Contact / complaints / events open insert (`WITH CHECK true`) | Edge rate limit + honeypot + length CHECK |
| PUB-7 | — | Deferred | Coating cards still generic `/book` (PPF path fixed) | Optional query params on other cards |
| PUB-8 / PUB-9 | — | Deferred | Multiple Book / Push entry points | UX density, not broken |
| AUTH-P0-1 | P0 | OPEN | getSession on PublicUtilityPage (and related) | Prefer getUser |
| OPS-P0-1 | P0 | OPEN | In-memory rate limits (plate-lookup etc.) | Shared store |
| DB-P0-1 | P0 | OPEN | Public book also allocates queue numbers | Shared UNIQUE/RPC |

Fixed references: PUB-1–6, PUB-12, CUST-C1/C2/H3/H6/H8.
