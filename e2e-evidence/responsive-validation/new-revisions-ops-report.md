# Responsive validation — NewRevisions ops surfaces

**Date:** 2026-08-27  
**Method:** CSS/source contract audit (no Playwright MCP in session). Touch targets + overflow rules checked against `src/styles.css` + page classNames.  
**Pages in scope:** Team Lead Queue (`.qmgr`), POS cart sheet, Bookings calendar, Branch inventory tables, Finance tabs.

## Viewport matrix (contract)

| Viewport | Layout | Touch (≥44px) | Typography | Content | Verdict |
|----------|--------|---------------|------------|---------|---------|
| 375 | `.qmgr` flex column, status grid 3-col, filters 2-col | Search + status cards **min-height 44px** (QA fix) | body ≥0.9rem inputs | History accordion, FIFO Next badge | **PASS** |
| 393 | same | same | same | same | **PASS** |
| 430 | same | same | same | same | **PASS** |
| 768 | calendar toolbar stacks `@media (max-width: 800px)` min-h 44px buttons | OK | OK | Calendar + board | **PASS** |
| 1024 | multi-col finance/POS | N/A desktop | OK | Tabs | **PASS** |
| 1280–1920 | floor board + finance dashboards | N/A | OK | Charts | **PASS** |

## Fixes applied this QA pass
1. `.qmgr-search` / `.qmgr-status-card` → `min-height: 44px` (was ~2.65rem / 3.15rem).
2. Calendar event colors no longer forced by CSS `!important` or Tailwind `bg-primary` (service distinction visible).

## Residual (manual device smoke)
- [ ] Landscape 667×375 on TL queue — confirm Next badge + status grid no horizontal scroll
- [ ] POS cart sheet on iPhone SE — discount + locked handoff copy readable
- [ ] Finance Corporate tab on tablet — investor never sees HQ (role gate)

## Overall verdict: **CONDITIONAL PASS**
Contract + CSS touch/overflow rules pass. Full Playwright matrix not executed in this session — run device smoke before owner demo.
