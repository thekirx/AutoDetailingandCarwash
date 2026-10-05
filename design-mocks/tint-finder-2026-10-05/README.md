# Hakum tint client approval

Public review: https://hakum-tint-approval.vercel.app

A is the existing React service page at `/services/tint#tint-finder`. B–E are standalone HTML pages, shared plain CSS, and vanilla JavaScript. They use bundled fonts, existing Hakum installation photos, and the original nine handover benefit illustrations. No external UI libraries are required.

- B Studio: bright editorial split and strong typography.
- C Night Drive: cinematic dark scene and vertical consultation.
- D Pit Lane: racing angles, cobalt panels, horizontal film comparisons.
- E Quiet Precision: generous whitespace, narrow consultation, open result rows.

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

## Design concept adaptation

Four generated concept boards guided the direction before HTML implementation. Actual pages intentionally retain real Hakum photos instead of generated car imagery, all nine original benefit illustrations instead of generic generated icons, and the approved catalog, film statistics and disclaimers instead of invented concept copy. Studio keeps the editorial hierarchy, Night Drive the dark full-bleed hero, Pit Lane the angled cobalt hero and horizontal comparison, Quiet Precision the quieter asymmetric photo and open layout. Screenshots were inspected for hierarchy, spacing, branding, image crops and responsive fit.
