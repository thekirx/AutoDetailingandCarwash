# Homepage Redesign and iPhone Safe-Area Recovery

## Goal

Restore the public homepage design represented by commit `65f4003` to the deployed `main` branch while retaining the two later iPhone Safari viewport changes.

## Root Cause

The homepage redesign remains on `agent/homepage-services-redesign` and is the head of draft PR #4. Two iPhone Safari fixes were committed directly to `main`, whose prior state did not contain the redesign. Vercel therefore deployed the old homepage with the safe-area changes instead of the approved redesign.

## Integration Design

1. Merge the latest `origin/main` into `agent/homepage-services-redesign` using normal Git history.
2. Resolve any overlap by preserving the redesigned homepage from `65f4003` and adding only these `main` changes:
   - `viewport-fit=cover` in the viewport meta tag.
   - `env(safe-area-inset-top)` padding on the fixed public header.
3. Verify that no other redesign files are replaced by their older `main` versions.
4. Test the restored homepage on desktop and an iPhone-sized viewport, including the top safe-area/header composition.
5. Push the integrated feature branch, then merge PR #4 into `main` so the corrected design becomes the deployable source.

## Safety and Scope

- Do not force-push or reset shared history.
- Do not change unrelated homepage sections or application behavior.
- Do not alter the approved service, ceramic package, or informational Other Services designs.
- Preserve the four optimized WebP service assets already tracked on the redesign branch.

## Verification

- Confirm the merged tree contains the redesign commit and both iPhone fix commits.
- Run the existing local test suite, targeted lint, and production build.
- Render desktop and iPhone-sized views and check for browser error overlays or new console errors.
- Confirm the feature branch and `main` remote heads point to the expected commits after publishing.
