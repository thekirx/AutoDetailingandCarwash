# SEO & AI Visibility Architecture — Hakum Auto Care (`www.hakumautocare.com`)

**Last Updated:** 2026-11-26  
**Guidance Reference Date:** 2026-11-26  
**Canonical Origin:** `https://www.hakumautocare.com`  
**Target Market / Locale:** Philippines (`en-PH`) — Cavite (Bacoor, Imus, Dasmariñas, General Trias, Kawit, Tagaytay) & Batangas (Batangas City, Alangilan, Kumintang, Pallocan, Balagtas, Bauan, Lipa)

---

## 1. Public URL Inventory & Indexation Policy

| Route Pattern | Count | Intended Index Status | Prerender & Crawler Rendering |
| :--- | :---: | :--- | :--- |
| `/` | 1 | `index,follow` (canonical) | `dist/index.html` + `/api/seo?operation=home-meta` |
| `/services`, `/services/ppf`, `/services/ceramic`, `/services/tint`, `/services/wash-detailing`, `/tint-finder`, `/shop` | 7 | `index,follow` | Static build prerender + `/api/seo?operation=service-meta` |
| `/branches` | 1 | `index,follow` | Static build prerender (`LocalBusiness` / `AutomotiveBusiness`) |
| `/branches/:citySlug` (`bacoor`, `batangas`, `imus`, `cavite`, `dasmarinas`) | 5 | `index,follow` | Static build prerender + `/api/seo?operation=branch-meta` |
| `/branches/:citySlug/:serviceSlug` (5 cities × 5 service pillars: `car-wash`, `auto-detailing`, `ceramic-coating`, `ppf`, `window-tint`) | 25 | `index,follow` | Static build prerender + `/api/seo?operation=branch-service-meta` (aliases return HTTP 301 to canonical) |
| `/book`, `/queue`, `/queue/bacoor`, `/queue/batangas`, `/partnerships`, `/events`, `/blog`, `/contact` | 8 | `index,follow` | Static build prerender (`Blog`, `ItemList`, `BreadcrumbList`) |
| `/blog/:slug` (9 built-in authority guides synced in `public.blogs` + live DB posts) | 9+ | `index,follow` (respects `noindex` & `scheduled` gates) | Static build prerender + `/api/seo?operation=blog-meta` |
| `/events/:slug` (published DB events) | Dynamic | `index,follow` | `/api/seo?operation=event-meta` |
| `/refer` | 1 | `noindex,nofollow` when disabled; `index,follow` when enabled | Client `usePageMeta` toggles `noindex: !settings.enabled` |
| `/terms`, `/privacy`, `/cookies` | 3 | `noindex,follow` | Static build prerender + `LegalPages.jsx` `robots: 'noindex,follow'` |
| `/home`, `/complaints`, `/signin`, `/signup`, `/account/*`, `/f/:slug`, `/r/:code`, `/403`, `/404` | Gated / Alias | `noindex,nofollow` | Excluded from `sitemap.xml`; explicit `noindex` + `googlebot` cleanup on SPA navigation |
| `/api/*`, `/operations/*`, `/app/*`, `/queue/*/tv` | Gated | `noindex,nofollow` (`X-Robots-Tag` + `robots.txt` disallow + `usePageMeta` `noindex`) | Excluded from search & AI crawlers |

---

## 2. Keyword & Local Search Intent Map (Bacoor, Batangas & Regional Expansion)

| Target City / Hub | Primary & Inverted Keyword Permutations Covered | Canonical URL(s) |
| :--- | :--- | :--- |
| **Batangas City** *(Open Studio · National / PNP Hwy, Brgy. Alangilan)* | `batangas car wash`, `car wash batangas`, `batangas city car wash`, `car wash batangas city`, `best car wash in batangas city`, `car wash alangilan batangas`, `auto detailing batangas`, `interior detailing batangas`, `ceramic coating batangas`, `ppf batangas`, `ppf batangas city`, `window tint batangas`, `acid rain removal batangas`, `watermark removal batangas`, `engine wash batangas`, `bactozero batangas` | `/branches/batangas`, `/branches/batangas/car-wash`, `/branches/batangas/auto-detailing`, `/branches/batangas/ceramic-coating`, `/branches/batangas/ppf`, `/branches/batangas/window-tint`, `/blog/best-car-wash-detailing-batangas-city` |
| **Bacoor, Cavite** *(Open Flagship · RFC Molino II, Molino Blvd)* | `bacoor car wash`, `car wash bacoor`, `best car wash in bacoor`, `car wash molino bacoor`, `auto detailing bacoor`, `interior detailing bacoor`, `ppf bacoor`, `bacoor ppf`, `ppf bacoor near me`, `paint protection film bacoor`, `clearpro ppf bacoor`, `ceramic coating bacoor`, `kisho ceramic coating bacoor`, `window tint bacoor`, `paint correction bacoor`, `watermark removal bacoor`, `bactozero bacoor`, `engine wash bacoor` | `/branches/bacoor`, `/branches/bacoor/car-wash`, `/branches/bacoor/auto-detailing`, `/branches/bacoor/ceramic-coating`, `/branches/bacoor/ppf`, `/branches/bacoor/window-tint`, `/blog/best-car-wash-detailing-bacoor` |
| **Cavite Regional** *(All Corridors + Tagaytay / GenTri / Kawit)* | `cavite car wash`, `car wash cavite`, `auto detailing cavite`, `ceramic coating cavite`, `ppf cavite`, `clearpro ppf cavite`, `window tint cavite`, `paint correction cavite` | `/branches/cavite`, `/branches/cavite/*`, `/blog/best-auto-detailing-ceramic-coating-ppf-cavite` |
| **Imus, Cavite** *(Vermosa, Buhay na Tubig, Aguinaldo Hwy + Upcoming Bay)* | `imus car wash`, `car wash imus`, `car wash imus cavite`, `auto detailing imus`, `ceramic coating imus`, `ppf imus`, `window tint imus`, `car wash near vermosa` | `/branches/imus`, `/branches/imus/*`, `/blog/best-car-wash-detailing-imus` |
| **Dasmariñas, Cavite** *(Salawag, Paliparan, Salitran, Pala-Pala + Upcoming Bay)* | `dasmarinas car wash`, `car wash dasmarinas`, `dasma car wash`, `auto detailing dasmarinas`, `ceramic coating dasmarinas`, `ppf dasmarinas`, `window tint dasmarinas` | `/branches/dasmarinas`, `/branches/dasmarinas/*`, `/blog/best-car-wash-detailing-dasmarinas` |

---

## 3. Structured Data, Crawler Rendering & Technical Controls

- **Single Source of Truth Architecture:** Core static route metadata lives in `src/lib/publicSeoCatalog.js` (`PUBLIC_ROUTE_SEO`, `SERVICE_SEO_BY_SLUG`), while all 5 city hubs, 25 branch × service pages, 14-service catalog (`COMPLETE_DETAILING_CATALOG`), 6 verified brand partners (`STUDIO_PRODUCTS_AND_BRANDS`), and 5 workmanship benchmark rows (`STUDIO_COMPARISON_ROWS`) live in `src/lib/localBranchPages.js` — consumed identically by React runtime pages, `scripts/prerender-seo.mjs`, and serverless crawler HTML generators in `server/seoApi.mjs`.
- **Schema.org JSON-LD Graphs:**
  - Every city hub emits `AutomotiveBusiness` + `AutoWash` + `OfferCatalog` (14 services) + verified `GeoCoordinates` + Google Maps `CID` (`hasMap`) + `BreadcrumbList` + `FAQPage`. No fabricated `aggregateRating` is ever emitted.
  - Every branch × service page emits `Service` + `OfferCatalog` + `AutomotiveBusiness` + `BreadcrumbList` + `FAQPage`.
- **AI Search & Answer Engine Readiness (GEO):**
  - Front-loaded self-contained executive summary / quick answer callouts (`bd-ai-callout`) on every city hub and branch × service page.
  - Structured HTML comparison tables (`bd-comparison-table`) and factual specifications (ClearPro Polyoptico TPU 10-year warranty, Kisho Japan Si-811/Si-901 9H ceramic, Rupes BigFoot, Menzerna Germany, ClearPro & F1 Nano-Ceramic Tint, Sonax/Meguiar's/Microtex).
  - Full HTML delivery to crawlers that do not execute client JS (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `PerplexityBot`, `Googlebot`, `Bingbot`, `Applebot`) via both build-time pre-rendering (`dist/**/*.html`) and Vercel header-matched `/api/seo` crawler rewrites.
  - Consolidated `public/robots.txt` (single `User-agent: *` block, explicit allow for search/AI-search bots, disallow for `Bytespider`/`CCBot` training scrapers).
  - Updated `public/llms.txt` as an optional curated map for LLMs that inspect it (no ranking or AI inclusion guarantee implied).

---

## 4. SEO Audit Findings, Severity & Acceptance Criteria

| Finding | Severity | Fix Implemented | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| Live Vercel SPA catch-all `404` on `/queue/:branch`, `/operations/*`, `/account`, `/signin` under `cleanUrls: true` | **Critical** | Changed `vercel.json` fallback destination from `"/index.html"` to `"/index"` and updated `prodShellContract` / `vercelFunctionRouting` tests | Non-prerendered SPA routes resolve HTTP `200` on production deploy; hashed assets stay excluded from SPA fallback |
| Invalid `path-to-regexp` wildcard in `vercel.json` `X-Robots-Tag` header (`/(api\|operations\|app\|account)/.*`) | **High** | Replaced with valid `/(api\|operations\|app\|account)/(.*)` + exact `/(operations\|app\|account)` rules | Gated endpoints & admin/account shells return `X-Robots-Tag: noindex, nofollow` and deploy cleanly |
| Missing serverless bot SSR on `/` and `/branches`, plus missing AI/audit crawler UAs | **High** | Added `home-meta` & `branches-meta` in `api/seo.js` / `server/seoApi.mjs` and expanded `has` user-agent regex in `vercel.json` | Googlebot, OAI-SearchBot, Claude-SearchBot, PerplexityBot, GPTBot & audit bots receive semantic HTML + JSON-LD |
| 42 meta description outliers (401–835 chars on `/blog/*`) and 80–119 char titles | **High** | Separated concise 120–160 char `seo_description` from full `ai_summary` body/JSON-LD across `prerender-seo.mjs`, `BlogPostPage.jsx`, `localBranchPages.js`, `seoLocalGuides.js`, `PublicPageMeta.jsx`, and `index.html`; enforced via unit test | Full decoded `<title>` `<= 75` chars and `<meta name="description">` `120–160` chars across all static HTML files |
| `noindex` drift on `/terms`, `/privacy`, `/cookies`, `/queue/*/tv`, `/f/:slug`, `/signin`, `/signup`, `/operations/login`, and stale `googlebot`/`hreflang` tags on SPA transitions (`2026-11-26`) | **Medium** | Added `robots` (`noindex,follow`) support and stale tag cleanup in `pageMeta.js`, updated `PublicPageMeta.jsx` `NOINDEX_PATHS`, added `noindex` in `LegalPages.jsx`, `PublicQueueTvPage.jsx`, `PublicFormPage.jsx`, auth/ops pages | Every legal/auth/form/TV/ops route consistently preserves `noindex` and clean head directives |
| `/partnerships`, `/queue/bacoor`, `/queue/batangas` missing from sitemap/prerender, invalid `og:type="service"`, Dasmariñas LocalBusiness URL fragment, `sitemap.xml` `lastmod` drift (`2026-11-26`) | **Medium** | Added `/partnerships`, `/queue/bacoor`, `/queue/batangas` to `STATIC_SITEMAP_ROUTES`, `prerender-seo.mjs`, `public/llms.txt`; fixed `og:type="website"` & `updated_at \|\| published_at` in `server/seoApi.mjs`; added `dasmarinas` + canonical FB page ID to `pageMeta.js` | `public/sitemap.xml` matches `buildSitemapXml()` 1:1; all public marketing/queue pages ship prerendered HTML & valid OGP types |
| Blocking Ops/Customer-App CSS (`finance.css`, `daily-sheet.css`, `styles-customer-app.css`), `papaparse`, and `OperationsLayout` loaded on initial public entry (`2026-11-26`) | **Optimization** | Moved ops CSS & `papaparse` to lazy `OperationsLayout.jsx`, customer-app CSS to `CustomerAppFrame.jsx` + `HakumAuthShell.jsx`, lazy-loaded `OperationsLayout`/`LoginPage`/`NotFoundPage`, added `fetchPriority="high"` to hero posters & `loading="lazy"`/`decoding="async"` to below-fold app shots | Reduced initial public CSS & entry JS payload while improving LCP hints on public routes |
| Existing `FAQPage` JSON-LD on service/branch/blog guides (Note: Google retired `FAQPage` rich results for all sites on May 7, 2026; zero deprecated `HowTo` schemas emitted) | **Info** | Retained valid structured Q&A graph for semantic clarity without claiming SERP FAQ rich-result or guaranteed AI-citation eligibility | Clean Schema.org compliance with current Google Search guidance |

---

## 5. Implementation Status vs. External Verification

| Layer | Status | Scope & Notes |
| :--- | :--- | :--- |
| **Implemented in Code** | Done | 5 city hubs, 25 branch × service routes, 14-service catalog, 6 verified product brands, comparison tables, executive summary blocks, `OfferCatalog` + `LocalBusiness`/`AutomotiveBusiness` + `Service` + `BreadcrumbList` JSON-LD, crawler SSR (`server/seoApi.mjs`), pre-renderer (`scripts/prerender-seo.mjs`), synced `public/sitemap.xml` & `public/llms.txt`, `vercel.json` cleanUrls SPA fallback & `X-Robots-Tag`, strict `noindex` enforcement, and route-split CSS/JS optimization |
| **Validated Locally** | Verified | `npm test`, `npm run lint`, `npm run audit:api-auth`, `npm run check`, `npm run build` (`60` prerendered HTML shells + synced `dist/sitemap.xml`) |
| **Live Production Deployment** | Verified Prior (`2026-11-21`) · Pending Re-deploy for `2026-11-26` batch | Previous deployment verified HTTP `200` on `https://www.hakumautocare.com` across `/`, `/shop`, `/terms`, `/branches/batangas/car-wash`, `/branches/bacoor/ppf`, `/queue/batangas`, `/operations/login` (`X-Robots-Tag`), `/sitemap.xml`, `/llms.txt`, `/robots.txt`, `/rss.xml`; `2026-11-26` changes ready for deploy & post-deploy verification |
| **GSC / External Links (Owner Actions)** | Pending Owner Action | 1) Re-submit `https://www.hakumautocare.com/sitemap.xml` in Google Search Console & Bing Webmaster Tools; 2) Verify Google Business Profile Batangas (`cid: 9079854389115198830`) and Bacoor listings link to `https://www.hakumautocare.com/branches/batangas` and `/branches/bacoor` |
