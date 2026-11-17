# Hakum Auto Care — SEO & AI Search Visibility Playbook

Verified baseline and implementation record for `https://www.hakumautocare.com`.

## Brand Positioning (Implemented)
> "Hakum Auto Care is one of the fastest-growing and most trusted automotive detailing, paint protection (PPF & ceramic coating), and car wash studios in the Philippines, serving Bacoor, Imus, Cavite, and Batangas."

No fabricated aggregate ratings, unverified store addresses, or unverified awards are emitted in metadata or JSON-LD.

## Public Indexable URL Inventory (Sitemap + Pre-rendered Static Route Shells)
- `/` (`index.html`) — Flagship homepage (`Organization` + `WebSite` JSON-LD, semantic hero copy & studio links)
- `/services` — Car Wash, Detailing, Ceramic Coating, ClearPro PPF & Ceramic Tint catalog
- `/services/ppf`, `/services/ceramic`, `/services/tint`, `/services/wash-detailing`, `/tint-finder`
- `/branches` — Branches overview + interactive "Find nearest car wash / detailing studio near me" (`NearestBranchFinder`) using GPS geolocation or quick-city presets (`Bacoor`, `Imus`, `Cavite / Dasmariñas`, `Batangas City`)
- `/branches/bacoor` — Bacoor, Cavite flagship (`RFC Molino II, Molino Boulevard, Bacoor, Cavite`, `0915 629 6096`, Maps CID `38179785010672017`)
- `/branches/batangas` — Batangas City flagship (`National Highway, Brgy. Alangilan, Batangas City`, `0956 007 1028`, Maps CID `9079854389115198830`)
- `/branches/imus` — Imus, Cavite landing page routing Imus drivers to Bacoor flagship & upcoming Imus expansion
- `/branches/cavite` — Cavite province hub (Bacoor, Imus, Molino, Dasmariñas)
- `/book`, `/queue`, `/events`, `/contact`, `/partnerships`
- `/blog` — Dedicated indexable blog hub (previously redirected to `/events#blog`)
- `/blog/:slug` — Built-in authority guides + live Supabase CMS posts with custom `seo_title`, `seo_description`, `seo_keywords`, `ai_summary`, and enhanced `BlogPosting` JSON-LD

## Gated / Non-Indexable Routes (`robots.txt`)
Disallowed across crawlers: `/operations`, `/app`, `/account`, `/signin`, `/signup`, `/queue/*/tv`, `/403`, `/404`.
Explicitly allowed for public routes: `Googlebot`, `Bingbot`, `Applebot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`.

## Status Separation (Implemented vs Validated vs Submitted / Observed)
- **Implemented in repo**:
  - Updated copy, titles, canonicals, Open Graph/Twitter meta across `index.html`, `PublicPageMeta.jsx`, `pageMeta.js`, `BdHero.jsx`, `PublicPages.jsx`, and `BranchCityPage.jsx`.
  - Pre-rendered static route HTML (`dist/<route>/index.html`) generated cleanly by `scripts/prerender-seo.mjs` post-`vite build` without modifying `dist/index.html` Workbox precache digests.
  - Enriched `AutomotiveBusiness` (`additionalType: AutoWash`, real `geo`, `hasMap`, `serviceArea`, `hasOfferCatalog`) and `BlogPosting` (`keywords`, `wordCount`, `about`, `spatialCoverage`) JSON-LD.
- **Validated locally**:
  - Unit tests (`tests/publicMeta.test.js` + route/SEO suite), full `npm run build` output, and headless Chromium DOM verification against `vite preview`.
- **Submitted / External (Operator action required outside repo)**:
  - Re-submit `https://www.hakumautocare.com/sitemap.xml` in Google Search Console & Bing Webmaster Tools and request indexing on `/` and `/branches/bacoor`, `/branches/batangas`, `/branches/imus`, `/branches/cavite`, `/blog` so Google's cached snippet updates from old description (`"car maintenance and repair..."`) to the new Hakum positioning and cites `hakumautocare.com` alongside Google Business Profiles.
