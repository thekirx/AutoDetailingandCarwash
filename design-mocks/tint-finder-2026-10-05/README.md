# Hakum tint client approval

Public review: https://hakum-tint-approval.vercel.app

A is the existing React service page at `/services/tint#tint-finder`. B–E are standalone HTML pages, shared plain CSS, and vanilla JavaScript. They use bundled fonts, existing Hakum installation photos, and the original nine handover benefit illustrations. No external UI libraries are required.

- B Signature: full-width Hakum installation hero and a split finder.
- C Installation: hands-on installation split hero and a vertical consultation.
- D Comparison: compact service hero and horizontal film comparisons.
- E Guided Care: consultation brought forward and open recommendation rows.

All four use the same catalog and pure recommendation engine as the application. Their questionnaire, film statistics, vehicle reference prices, ordered benefits, disclaimers and booking preview are interactive. Sales enquiry opens the same demonstration consultation form. No personal data is persisted or transmitted by these mocks.

## Rebuild the isolated approval project

Use a clean checkout of `codex/tint-finder` so unrelated local edits are excluded. Run `npm ci`, then:

```sh
VITE_TINT_APPROVAL_PREVIEW=true VITE_SUPABASE_URL=https://local-preview.invalid VITE_SUPABASE_ANON_KEY=local-preview-public-key npm run build
mkdir -p .vercel/output/static
cp -R dist/. .vercel/output/static/
cp -R design-mocks/tint-finder-2026-10-05 .vercel/output/static/tint-designs
cp design-mocks/tint-finder-2026-10-05/vercel-output-config.json .vercel/output/config.json
vercel link --yes --project hakum-tint-approval --scope thekirxs-projects
vercel deploy --prebuilt --prod --yes --scope thekirxs-projects
```

This deploys the isolated `hakum-tint-approval` project. Do not use the live website project. The preview flag disables live tint config/branch queries and real tint booking submission in A; ordinary application builds keep their existing behavior. Only static build output is uploaded. No API functions, environment files, production keys or database changes are included.

To preview HTML locally, serve this directory over HTTP (ES modules and the catalog fetch require a server).

## Verification

Manually exercised all four complete desktop journeys at 1440px, including demo booking success. Checked all four questionnaires and results at 390px and 320px, no horizontal overflow after the Pit Lane FAQ correction. Verified 3 personalized benefits, all 9 illustrations, front/rear statistics, and prices for prescription/balance/SUV and poor/visibility/van. Checked the original preview config and branch loading, design links and demo submission mode. Targeted lint and 34 catalog/API unit tests passed.

## Brand revision — 06 October 2026

The revised layouts use the existing website as the reference: deep navy `#020a31`, cobalt `#052699`, pale blue `#9db4ff`, paper text `#f1f1ed`, Benzin ExtraBold italic uppercase headings, Gilmer body type, pill CTAs, the existing header logo dimensions and translucent navy navigation. Brand foundations come from `src/design-tokens.css`, `src/styles.css` and `src/styles/bredesign.css`. Footer language is taken from `src/layouts/PublicLayout.jsx`.

No AI-generated photos are used. Every photo is an unchanged copy of an existing Hakum tint asset. `asset-sources.json` records the original file paths and SHA-256 hashes. The source content explicitly identifies these as Hakum installation photographs or stills from its tint clips. The original handover benefit illustrations are retained.

Mismatch ledger: the previous light page backgrounds, normal display headings, square buttons, logo badge and generic closing/footer copy have been replaced by the website navy, matching heavy italic headings, pill buttons, unchanged website logo treatment, and its own CTA/footer wording. The four options differ through composition, finder placement and comparison layout while sharing the brand system.

Revised QA: rendered all four at 1440px, 390px and 320px; no page overflow, missing images, framework overlays or relevant console errors. Exercised all questionnaires and reference-price results, nine benefits, mobile menu open/close, and booking preview opening. Photo checksums match the original files.
