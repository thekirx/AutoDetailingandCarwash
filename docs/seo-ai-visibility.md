# SEO & AI Visibility Architecture — Hakum Auto Care (`www.hakumautocare.com`)

**Last Updated:** 2026-11-21  
**Canonical Origin:** `https://www.hakumautocare.com`  
**Target Market / Locale:** Philippines (`en-PH`) — Cavite (Bacoor, Imus, Dasmariñas, General Trias, Kawit, Tagaytay) & Batangas (Batangas City, Alangilan, Kumintang, Pallocan, Balagtas, Bauan, Lipa)

---

## 1. Public URL Inventory & Indexation Policy

| Route Pattern | Count | Intended Index Status | Prerender & Crawler Rendering |
| :--- | :---: | :--- | :--- |
| `/` | 1 | `index,follow` (canonical) | `dist/index.html` |
| `/services`, `/services/ppf`, `/services/ceramic`, `/services/tint`, `/services/wash-detailing`, `/tint-finder`, `/shop` | 7 | `index,follow` | Static build prerender + `/api/seo?operation=service-meta` |
| `/branches` | 1 | `index,follow` | Static build prerender (`LocalBusiness` / `AutomotiveBusiness`) |
| `/branches/:citySlug` (`bacoor`, `batangas`, `imus`, `cavite`, `dasmarinas`) | 5 | `index,follow` | Static build prerender + `/api/seo?operation=branch-meta` |
| `/branches/:citySlug/:serviceSlug` (5 cities × 5 service pillars: `car-wash`, `auto-detailing`, `ceramic-coating`, `ppf`, `window-tint`) | 25 | `index,follow` | Static build prerender + `/api/seo?operation=branch-service-meta` (aliases return HTTP 301 to canonical) |
| `/book`, `/queue`, `/events`, `/blog`, `/contact` | 5 | `index,follow` | Static build prerender (`Blog`, `ItemList`, `FAQPage`) |
| `/blog/:slug` (9 built-in authority guides synced in `public.blogs` + live DB posts) | 9+ | `index,follow` (respects `noindex` & `scheduled` gates) | Static build prerender + `/api/seo?operation=blog-meta` |
| `/events/:slug` (published DB events) | Dynamic | `index,follow` | `/api/seo?operation=event-meta` |
| `/terms`, `/privacy`, `/cookies` | 3 | `noindex,follow` | Static build prerender (`noindex,follow` shells); updated Nov 21, 2026 |
| `/home`, `/complaints`, `/403`, `/404` | 4 | `noindex,nofollow` | Excluded from `sitemap.xml`; explicit `noindex` |
| `/api/*`, `/operations/*`, `/app/*`, `/account/*`, `/signin`, `/signup`, `/queue/*/tv` | Gated | `noindex,nofollow` (`X-Robots-Tag` + `robots.txt` disallow) | Excluded from search & AI crawlers |

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

## 4. SEO Audit Findings, Severity & Acceptance Criteria (`2026-11-21`)

| Finding | Severity | Fix Implemented | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| Live Vercel SPA catch-all `404` on `/queue/:branch`, `/operations/*`, `/account`, `/signin` under `cleanUrls: true` | **Critical** | Changed `vercel.json` fallback destination from `"/index.html"` to `"/index"` and updated `prodShellContract` / `vercelFunctionRouting` tests | Non-prerendered SPA routes resolve HTTP `200` on production deploy; hashed assets stay excluded from SPA fallback |
| Invalid `path-to-regexp` wildcard in `vercel.json` `X-Robots-Tag` header (`/(api\|operations\|app\|account)/.*`) | **High** | Replaced with valid `/(api\|operations\|app\|account)/(.*)` + exact `/(operations\|app\|account)` rules | Gated endpoints & admin/account shells return `X-Robots-Tag: noindex, nofollow` and deploy cleanly |
| Missing serverless bot SSR on `/` and `/branches`, plus missing AI/audit crawler UAs | **High** | Added `home-meta` & `branches-meta` in `api/seo.js` / `server/seoApi.mjs` and expanded `has` user-agent regex in `vercel.json` | Googlebot, OAI-SearchBot, Claude-SearchBot, PerplexityBot, GPTBot & audit bots receive semantic HTML + JSON-LD |
| 42 meta description outliers (401–835 chars on `/blog/*`) and 80–119 char titles | **High** | Separated concise 120–160 char `seo_description` from full `ai_summary` body/JSON-LD across `prerender-seo.mjs`, `BlogPostPage.jsx`, `localBranchPages.js`, `seoLocalGuides.js`, `PublicPageMeta.jsx`, and `index.html`; enforced via unit test | Full decoded `<title>` `<= 75` chars and `<meta name="description">` `120–160` chars across all 53 `dist/` HTML files |
| Main entry chunk `index-*.js` above Vite 500 kB notice | **Resolved** | Added `router`, `ui-vendor`, and `csv` `manualChunks` in `vite.config.js` | `index-*.js` reduced from `520.51 kB` to `383.10 kB` (`115.61 kB` gzip) with zero `>500 kB` Vite warnings |

---

## 5. Implementation Status vs. External Verification

| Layer | Status | Scope & Notes |
| :--- | :--- | :--- |
| **Implemented in Code** | Done | 5 city hubs, 25 branch × service routes, 14-service catalog, 6 verified product brands, comparison tables, executive summary blocks, `OfferCatalog` + `FAQPage` JSON-LD, crawler SSR (`server/seoApi.mjs` including `home-meta` & `branches-meta`), pre-renderer (`scripts/prerender-seo.mjs`), `public/sitemap.xml`, `public/llms.txt`, `vercel.json` cleanUrls SPA fallback fix (`destination: "/index"`), valid `X-Robots-Tag` wildcard, and concise `<=75` char titles / `120–160` char meta descriptions |
| **Validated Locally** | Verified | `npm test` (unit suite covering all 25 local routes, aliases, meta lengths, schemas, crawler SSR & routing contract), `npm run lint`, `npm run audit:api-auth`, `npm run check`, `npm run build` (`57` prerendered HTML shells) |
| **Live Production Deployment** | Verified Live | `https://www.hakumautocare.com` deployed & returning HTTP `200` on `/`, `/shop`, `/terms`, `/branches/batangas/car-wash`, `/branches/bacoor/ppf`, `/queue/batangas`, `/operations/login` (`X-Robots-Tag: noindex, nofollow`), `/account` (`X-Robots-Tag: noindex, nofollow`), `/sitemap.xml` (`53` `<loc>` URLs), `/llms.txt`, `/robots.txt`, and `/rss.xml`; Googlebot SSR HTML + JSON-LD verified live |
| **GSC / External Links (Owner Actions)** | Pending Owner Action | 1) Re-submit `https://www.hakumautocare.com/sitemap.xml` in Google Search Console & Bing Webmaster Tools; 2) Verify Google Business Profile Batangas (`cid: 9079854389115198830`) and Bacoor listings link to `https://www.hakumautocare.com/branches/batangas` and `/branches/bacoor` |
