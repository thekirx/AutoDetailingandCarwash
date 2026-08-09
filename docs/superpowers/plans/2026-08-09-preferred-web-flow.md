# Preferred Web Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation-first Hakum homepage flow, managed Posts/Events content area, restricted Marketing Content role, and destination-agnostic Partnership Inquiry form on `PreferedWebFlow`.

**Architecture:** Preserve the existing public components and styling while extracting homepage sections behind stable semantic boundaries. Extend the existing Supabase Events and RBAC systems, add one Posts source and a restricted content workspace, and keep the Partnership form behind a typed submission adapter that performs no network write in this branch.

**Tech Stack:** React 19, React Router 7, Vite 6, Supabase Auth/Postgres/Storage/RLS, existing Hakum CSS and UI components, Node's built-in test runner.

## Global Constraints

- Preserve the current assets, imagery, colors, typography, navigation, footer, ceramic panels, PPF information, PPF packages, PPF visualizer, branches/contact ending, functionality, and visual identity.
- Homepage order is Hero → Ceramic → PPF Information → PPF Packages → Nano Ceramic Tint → Videos and Photos → Latest Post → Events → Partnership Inquiry → existing ending.
- Required anchors are `#ceramic`, `#ppf`, `#tint`, `#media`, `#latest-post`, `#events`, and `#partnership`.
- Add GSAP-ready markers and reduced-motion behavior, but no final GSAP or ScrollTrigger animation runtime.
- Extend the existing Events implementation; never create a duplicate Events source.
- Public content is derived from Team Portal-managed Posts and Events and includes only published records.
- `content_marketing` is a separate restricted role labeled `Marketing Content` and lands on `/operations/content`.
- Do not authorize by email or user metadata; use the existing staff profile/RBAC pattern and database RLS.
- Partnership Inquiry never transmits data in this branch and remains independent of Supabase or any other final destination.
- Do not merge to `main`; commit and push only `PreferedWebFlow`.

---

## File Structure

### Content domain and public data

- `src/lib/contentStatus.js` — shared status constants and normalization.
- `src/lib/publicContent.js` — published Post/Event selection and Supabase reads.
- `src/components/public/HybridMediaCard.jsx` — shared public Post/Event card.
- `src/components/public/ContentEmptyState.jsx` — reusable empty/failure presentation.
- `tests/publicContent.test.js` — pure content-selection tests.

### Homepage

- `src/components/public/home/HomeHeroSection.jsx`
- `src/components/public/home/CeramicSection.jsx`
- `src/components/public/home/PpfInformationSection.jsx`
- `src/components/public/home/PpfPackagesSection.jsx`
- `src/components/public/home/NanoCeramicTintSection.jsx`
- `src/components/public/home/MediaGallerySection.jsx`
- `src/components/public/home/LatestPostSection.jsx`
- `src/components/public/home/EventsPreviewSection.jsx`
- `src/components/public/home/PartnershipSection.jsx`
- `src/components/public/home/HomeEndingSections.jsx`
- `src/components/public/home/MotionSection.jsx` — semantic wrapper and marker vocabulary.
- `src/pages/PublicLandingPage.jsx` — composition only, plus existing modal state.
- `src/data/publicHomeContent.js` — current assets and new tint/gallery fallback content.
- `src/styles.css` — preserve current rules and add scoped responsive/motion/content/form rules.

### Partnership Inquiry

- `src/lib/partnershipInquiry.js` — payload normalization, validation, typed unavailable adapter.
- `tests/partnershipInquiry.test.js` — validation and no-network adapter tests.

### Team Portal and RBAC

- `src/auth/permissions.js` — centralized role, capabilities, navigation, redirect, and route allowlist.
- `src/pages/OpsIndexRedirect.jsx` — existing role redirect integration.
- `src/App.jsx` — lazy `/operations/content` route.
- `src/pages/ContentManagePage.jsx` — Posts/Events tabs and orchestration.
- `src/components/content/PostEditor.jsx` — Post form and status actions.
- `src/components/content/EventEditor.jsx` — existing Events schema editor.
- `src/components/content/ContentList.jsx` — shared list/actions.
- `src/lib/contentAdmin.js` — authenticated Post/Event CRUD and media helpers.
- `tests/contentMarketingRole.test.js` — navigation, redirect, and fail-closed route matrix.

### Supabase

- Migration created by `supabase migration new preferred_web_flow_content` — role enum, content enum, Posts, Events extensions, grants, RLS, compatibility trigger, and content media bucket/policies.
- `supabase/tests/preferred_web_flow_content_verification.sql` — role/RLS/public visibility checks.

---

### Task 1: Content Domain Contracts

**Files:**
- Create: `tests/publicContent.test.js`
- Create: `src/lib/contentStatus.js`
- Create: `src/lib/publicContent.js`

**Interfaces:**
- Produces: `CONTENT_STATUSES`, `normalizeContentStatus(value)`, `selectLatestPublishedPost(rows, now)`, and `selectNextPublishedEvent(rows, now)`.
- Consumers: public homepage sections and Team Portal editors.

- [ ] **Step 1: Write failing content-domain tests**

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  selectLatestPublishedPost,
  selectNextPublishedEvent,
} from '../src/lib/publicContent.js'

describe('public managed content', () => {
  it('returns only the newest published post', () => {
    const rows = [
      { id: 'draft', status: 'draft', published_at: '2026-08-09T12:00:00Z' },
      { id: 'older', status: 'published', published_at: '2026-08-01T12:00:00Z' },
      { id: 'newer', status: 'published', published_at: '2026-08-08T12:00:00Z' },
    ]
    assert.equal(selectLatestPublishedPost(rows)?.id, 'newer')
  })

  it('returns the next non-archived published event', () => {
    const rows = [
      { id: 'past', status: 'published', starts_at: '2026-08-01T12:00:00Z' },
      { id: 'next', status: 'published', starts_at: '2026-08-12T12:00:00Z' },
      { id: 'archived', status: 'archived', starts_at: '2026-08-11T12:00:00Z' },
    ]
    assert.equal(selectNextPublishedEvent(rows, new Date('2026-08-09T12:00:00Z'))?.id, 'next')
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/publicContent.test.js`

Expected: FAIL because `src/lib/publicContent.js` does not exist.

- [ ] **Step 3: Implement pure status and selection helpers**

```js
export const CONTENT_STATUSES = Object.freeze(['draft', 'published', 'archived'])

export function normalizeContentStatus(value) {
  return CONTENT_STATUSES.includes(value) ? value : 'draft'
}
```

`publicContent.js` will export the two pure selectors and Supabase-backed `loadHomepageContent()`; selectors must tolerate null/empty rows and invalid dates.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/publicContent.test.js`

Expected: all tests pass.

- [ ] **Step 5: Commit the domain contract**

```bash
git add src/lib/contentStatus.js src/lib/publicContent.js tests/publicContent.test.js
git commit -m "feat: add public content domain contracts"
```

### Task 2: Supabase Content Schema, Storage, and RLS

**Files:**
- Create via CLI: migration returned by `supabase migration new preferred_web_flow_content`
- Create: `supabase/tests/preferred_web_flow_content_verification.sql`

**Interfaces:**
- Produces: `public.content_status`, `public.social_posts`, extended `public.events`, `content_marketing` enum role, public-content policies, and `content-media` bucket policies.
- Consumers: `src/lib/publicContent.js`, `src/lib/contentAdmin.js`, AuthProvider staff role resolution, and content editors.

- [ ] **Step 1: Verify current Supabase interfaces before writing SQL**

Run:

```bash
supabase --version
supabase migration --help
```

Then consult the current official Supabase changelog and documentation for Postgres RLS, Storage ownership/policies, and enum migrations. Use only official Supabase sources.

- [ ] **Step 2: Create the migration through the CLI**

Run: `supabase migration new preferred_web_flow_content`

Expected: a new timestamped SQL file under `supabase/migrations/` whose suffix is `_preferred_web_flow_content.sql`.

- [ ] **Step 3: Write the migration with backward-compatible Events behavior**

The migration must:

```sql
alter type public.profile_role add value if not exists 'content_marketing';

do $$ begin
  create type public.content_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'external' check (platform in ('facebook','instagram','external')),
  source_url text,
  title text not null,
  excerpt text,
  media_url text,
  cta_label text not null default 'View original post',
  status public.content_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

It must add the approved Events columns without dropping existing columns, backfill `status` from `is_published`, and add compatibility trigger logic so writes from either the legacy toggle or new status editor remain consistent.

- [ ] **Step 4: Add least-privilege grants and RLS**

Policies must enforce:

- anon/authenticated public readers see `status = 'published'` rows only;
- `content_marketing` and existing owner-level oversight can manage Posts and Events;
- UPDATE has both `USING` and `WITH CHECK`;
- no content role policy is added to unrelated tables;
- storage object management is restricted to bucket `content-media` and authenticated content managers;
- public media reads are bucket-scoped;
- upsert has INSERT, SELECT, and UPDATE coverage.

- [ ] **Step 5: Write SQL verification assertions**

`supabase/tests/preferred_web_flow_content_verification.sql` must assert table/column existence, RLS enablement, policy presence, enum values, public draft denial, public published visibility, content-role CRUD, and denial on a representative unrelated table such as `bookings`.

- [ ] **Step 6: Run local database verification**

Run the available local workflow discovered through `supabase --help`; at minimum apply the migration to a local/reset database and execute the verification SQL.

Expected: migration succeeds and every assertion completes without exception.

- [ ] **Step 7: Commit schema and verification**

```bash
git add supabase/migrations supabase/tests/preferred_web_flow_content_verification.sql
git commit -m "feat: add managed content schema and policies"
```

### Task 3: Restricted Marketing Content RBAC

**Files:**
- Create: `tests/contentMarketingRole.test.js`
- Modify: `src/auth/permissions.js`
- Modify: `src/App.jsx`
- Modify: `src/layouts/OperationsLayout.jsx`
- Modify: `src/pages/OpsIndexRedirect.jsx` only if it bypasses `redirectForRole`

**Interfaces:**
- Produces: `ROLES.CONTENT_MARKETING`, `canAccessContent(profile)`, `canManagePosts(profile)`, `canManageEvents(profile)`, content navigation, route key `content`, and redirect `/operations/content`.
- Consumers: protected route gate, Operations navigation, ContentManagePage, editors.

- [ ] **Step 1: Write the failing RBAC matrix**

```js
assert.equal(redirectForRole('content_marketing'), '/operations/content')
assert.equal(allowRoute({ role: 'content_marketing' }, 'content'), true)
assert.equal(allowRoute({ role: 'content_marketing' }, 'crm'), false)
assert.equal(allowRoute({ role: 'content_marketing' }, 'finance'), false)
assert.deepEqual(getOperationsNav({ role: 'content_marketing' }).map((item) => item.to), ['/operations/content'])
```

Also preserve assertions for the existing `marketing` role and current Admin role behavior.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/contentMarketingRole.test.js`

Expected: FAIL because the role and content route do not exist.

- [ ] **Step 3: Add centralized capabilities and navigation**

Add `CONTENT_MARKETING: 'content_marketing'` to `ROLES` and `OPS_LOGIN_ROLES`. Implement capability helpers from the single role constant. Add only a Content nav item for that role, add the route allowlist key, format the display name as `Marketing Content`, and redirect it to `/operations/content`.

- [ ] **Step 4: Register a lazy protected content route**

In `App.jsx`, lazy-load `ContentManagePage` and add:

```jsx
<Route path="content" element={gate('content', <ContentManagePage />)} />
```

- [ ] **Step 5: Run RBAC regression tests**

Run:

```bash
node --test tests/contentMarketingRole.test.js tests/marketingScope.test.js tests/permissions.marketingSales.test.js tests/permissions.test.js
```

Expected: all tests pass; existing Marketing/CRM and Admin paths remain unchanged.

- [ ] **Step 6: Commit RBAC integration**

```bash
git add src/auth/permissions.js src/App.jsx src/layouts/OperationsLayout.jsx src/pages/OpsIndexRedirect.jsx tests/contentMarketingRole.test.js
git commit -m "feat: add restricted marketing content role"
```

### Task 4: Shared Public Content Components

**Files:**
- Create: `src/components/public/HybridMediaCard.jsx`
- Create: `src/components/public/ContentEmptyState.jsx`
- Create: `src/components/public/home/LatestPostSection.jsx`
- Create: `src/components/public/home/EventsPreviewSection.jsx`
- Modify: `src/lib/publicContent.js`
- Modify: `src/styles.css`
- Modify: `tests/publicContent.test.js`

**Interfaces:**
- Consumes: content selectors/statuses from Task 1 and Supabase columns from Task 2.
- Produces: reusable public card props `{ kind, title, excerpt, mediaUrl, date, platform, href, ctaLabel }` and resilient homepage data states.

- [ ] **Step 1: Extend failing tests for card mapping and empty states**

Add pure `mapPostToHybridCard(row)` and `mapEventToHybridCard(row)` assertions, including missing media/source URL and invalid-date cases.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/publicContent.test.js`

Expected: FAIL because mapper exports do not exist.

- [ ] **Step 3: Implement normalized card mapping and resilient reads**

`loadHomepageContent()` performs separate queries so a Posts failure cannot suppress Events. It returns explicit `{ status, item, error }` objects for each content type.

- [ ] **Step 4: Build accessible shared visual components**

`HybridMediaCard` uses semantic `article`, current Hakum typography/classes, lazy image loading, alt text, visible CTA, and a fallback media surface. `ContentEmptyState` accepts an eyebrow, title, and body without presenting errors as raw database messages.

- [ ] **Step 5: Add scoped responsive CSS**

Add only `.home-content-*`, `.hybrid-media-*`, and `.content-empty-*` rules, using current color/font variables and existing `800px`, `700px`, and `500px` breakpoints.

- [ ] **Step 6: Run focused tests and lint touched files**

Run:

```bash
node --test tests/publicContent.test.js
npx eslint src/lib/publicContent.js src/components/public/HybridMediaCard.jsx src/components/public/ContentEmptyState.jsx src/components/public/home/LatestPostSection.jsx src/components/public/home/EventsPreviewSection.jsx
```

Expected: tests and lint pass.

- [ ] **Step 7: Commit shared public content**

```bash
git add src/lib/publicContent.js src/components/public src/styles.css tests/publicContent.test.js
git commit -m "feat: add shared public post and event cards"
```

### Task 5: Team Portal Content Workspace

**Files:**
- Create: `src/lib/contentAdmin.js`
- Create: `src/pages/ContentManagePage.jsx`
- Create: `src/components/content/PostEditor.jsx`
- Create: `src/components/content/EventEditor.jsx`
- Create: `src/components/content/ContentList.jsx`
- Create: `tests/contentAdmin.test.js`

**Interfaces:**
- Consumes: `canManagePosts`, `canManageEvents`, `CONTENT_STATUSES`, Supabase `social_posts`, existing `events`, and `content-media` storage.
- Produces: normalized Post/Event mutations, status transitions, media upload helper, and `/operations/content` UI.

- [ ] **Step 1: Write failing pure admin tests**

Test `normalizePostInput`, `normalizeEventInput`, `canTransitionContentStatus`, and `contentMediaPath` with valid, missing, and unsafe input.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/contentAdmin.test.js`

Expected: FAIL because `contentAdmin.js` does not exist.

- [ ] **Step 3: Implement pure normalization before I/O methods**

Normalize whitespace, URLs, optional media, date values, CTA copy, and status. Reject unsupported protocols and invalid transitions. CRUD methods call Supabase only after normalization and return `{ data, error }` without swallowing errors.

- [ ] **Step 4: Build the Posts and Events tab workspace**

Use existing Tabs, Card, Input, Textarea, Select, Button, and notification patterns. Keep editors focused: Posts owns Post fields; Events owns existing Event fields plus new managed-content fields; ContentList owns status/action presentation.

- [ ] **Step 5: Add media management**

Allow external media URLs and authenticated uploads to `content-media`. Validate MIME family and size before upload. Failed uploads preserve editor input and show a safe error.

- [ ] **Step 6: Add deletion confirmation and status actions**

Deletion requires an explicit confirmation dialog. Publish sets `published_at`; unpublish returns to draft; archive uses `archived`; all actions refresh only the affected tab.

- [ ] **Step 7: Run focused and RBAC tests**

Run:

```bash
node --test tests/contentAdmin.test.js tests/contentMarketingRole.test.js
npx eslint src/lib/contentAdmin.js src/pages/ContentManagePage.jsx src/components/content/*.jsx
```

Expected: all checks pass.

- [ ] **Step 8: Commit the content workspace**

```bash
git add src/lib/contentAdmin.js src/pages/ContentManagePage.jsx src/components/content tests/contentAdmin.test.js
git commit -m "feat: add posts and events content workspace"
```

### Task 6: Destination-Agnostic Partnership Inquiry

**Files:**
- Create: `src/lib/partnershipInquiry.js`
- Create: `tests/partnershipInquiry.test.js`
- Create: `src/components/public/home/PartnershipSection.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `normalizePartnershipInquiry(input)`, `validatePartnershipInquiry(input)`, and async `submitPartnershipInquiry(payload)` returning `{ ok: false, code: 'unavailable' }` in this branch.
- Consumers: `PartnershipSection` only; no Supabase import is permitted.

- [ ] **Step 1: Write failing validation and adapter tests**

```js
it('normalizes the approved five fields', () => {
  assert.deepEqual(normalizePartnershipInquiry({
    name: '  Ana  ', email: ' ANA@example.com ', contactNumber: ' 0917 123 ', city: ' Bacoor ', message: ' Hello ',
  }), {
    name: 'Ana', email: 'ana@example.com', contactNumber: '0917 123', city: 'Bacoor', message: 'Hello',
  })
})

it('returns unavailable without a network dependency', async () => {
  const payload = {
    name: 'Ana',
    email: 'ana@example.com',
    contactNumber: '0917 123 4567',
    city: 'Bacoor',
    message: 'We would like to discuss a fleet-care partnership.',
  }
  assert.deepEqual(await submitPartnershipInquiry(payload), { ok: false, code: 'unavailable' })
})
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/partnershipInquiry.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement normalization, validation, and unavailable adapter**

Return field-keyed errors for required values and invalid email. Do not call `fetch`, Supabase, an API, email, or a webhook.

- [ ] **Step 4: Build the accessible five-field form**

Fields: Name, Email, Contact Number, City, Message. Associate labels/errors with inputs, focus the first invalid field, use an `aria-live` status region, disable submit while validating/submitting, and display the explicit unavailable message after valid submission.

- [ ] **Step 5: Add responsive current-brand styling**

Use existing public shells, fonts, blue/white palette, buttons, and form conventions. Two columns may be used on desktop; all fields stack on mobile.

- [ ] **Step 6: Run focused tests and lint**

Run:

```bash
node --test tests/partnershipInquiry.test.js
npx eslint src/lib/partnershipInquiry.js src/components/public/home/PartnershipSection.jsx
```

Expected: tests and lint pass.

- [ ] **Step 7: Commit the form foundation**

```bash
git add src/lib/partnershipInquiry.js src/components/public/home/PartnershipSection.jsx src/styles.css tests/partnershipInquiry.test.js
git commit -m "feat: add partnership inquiry foundation"
```

### Task 7: Homepage Componentization and Approved Order

**Files:**
- Create: `src/components/public/home/MotionSection.jsx`
- Create: `src/components/public/home/HomeHeroSection.jsx`
- Create: `src/components/public/home/CeramicSection.jsx`
- Create: `src/components/public/home/PpfInformationSection.jsx`
- Create: `src/components/public/home/PpfPackagesSection.jsx`
- Create: `src/components/public/home/NanoCeramicTintSection.jsx`
- Create: `src/components/public/home/MediaGallerySection.jsx`
- Create: `src/components/public/home/HomeEndingSections.jsx`
- Modify: `src/pages/PublicLandingPage.jsx`
- Modify: `src/data/publicHomeContent.js`
- Modify: `src/styles.css`
- Modify: `tests/publicHomeContent.test.js`
- Modify: `tests/mobilePublicExperience.test.js`

**Interfaces:**
- Consumes: current Hakum assets/content, `PPFVisualizer`, shared content sections, PartnershipSection, branches hook, existing UI buttons/stat cards.
- Produces: approved homepage order and motion-hook vocabulary without final animation.

- [ ] **Step 1: Add failing source-contract tests**

Assert the rendered composition source includes the required section components in approved order and that each required anchor/motion marker exists. Assert current hero, ceramic assets, PPF visualizer, branch ending, and public layout assets remain referenced.

- [ ] **Step 2: Run source-contract tests and verify RED**

Run:

```bash
node --test tests/publicHomeContent.test.js tests/mobilePublicExperience.test.js
```

Expected: new section/order assertions fail.

- [ ] **Step 3: Extract existing sections without visual changes**

Move the current Hero, Ceramic, PPF, queue/branches ending, modal, and related behavior into focused files with minimal markup/class changes. Keep state in the smallest owning component.

- [ ] **Step 4: Add semantic motion wrapper**

```jsx
export default function MotionSection({ id, className = '', children, motion = 'section', ...props }) {
  return <section id={id} className={className} data-motion-section={motion} {...props}>{children}</section>
}
```

Motion markers never apply hidden initial styles.

- [ ] **Step 5: Add Nano Tint and Media foundations using current assets**

Use `ceramic-tint.webp` and existing service/gallery imagery. Videos render only when a valid source exists; fallback content remains image-based and usable. No new generated brand artwork is introduced.

- [ ] **Step 6: Recompose PublicLandingPage in exact approved order**

Keep modal behavior, branch loading, and lazy PPF visualizer behavior working while reducing the page to orchestration.

- [ ] **Step 7: Add reduced-motion and responsive rules**

Under `@media (prefers-reduced-motion: reduce)`, disable nonessential transitions, smooth scrolling, and animation-duration behavior for new public sections. Verify the mobile stack and no horizontal overflow.

- [ ] **Step 8: Run homepage tests and lint**

Run:

```bash
node --test tests/publicHomeContent.test.js tests/mobilePublicExperience.test.js tests/publicBranding.test.js
npx eslint src/pages/PublicLandingPage.jsx src/components/public/home/*.jsx src/data/publicHomeContent.js
```

Expected: all checks pass.

- [ ] **Step 9: Commit homepage composition**

```bash
git add src/pages/PublicLandingPage.jsx src/components/public/home src/data/publicHomeContent.js src/styles.css tests/publicHomeContent.test.js tests/mobilePublicExperience.test.js
git commit -m "feat: compose preferred public homepage flow"
```

### Task 8: Integration, Accessibility, and Final Verification

**Files:**
- Modify only as findings require: files introduced or touched in Tasks 1–7
- Create: `docs/content-marketing-provisioning.md`

**Interfaces:**
- Consumes: complete preferred flow foundation.
- Produces: verified branch and safe account-provisioning instructions.

- [ ] **Step 1: Document content account provisioning**

Document the existing Supabase Auth user creation step, the required `staff_profiles` assignment to `content_marketing`, expected `/operations/content` redirect, and a warning never to authorize by email or user metadata. Do not include a real password or secret.

- [ ] **Step 2: Run the full Node test suite**

Run: `node --test tests/*.test.js`

Expected: zero failures.

- [ ] **Step 3: Run lint and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both exit successfully. If local disk space still blocks dependency installation, report the environmental block explicitly and run all dependency-free checks that remain possible.

- [ ] **Step 4: Verify responsive public behavior in a browser**

At desktop and mobile widths, verify homepage order, preserved visual identity, navigation/footer, PPF interaction, hybrid Post/Event cards, Event empty state, Partnership validation/unavailable state, keyboard focus, reduced-motion emulation, and no horizontal overflow.

- [ ] **Step 5: Verify restricted Team Portal behavior**

Verify a `content_marketing` profile lands on `/operations/content`, sees only Content navigation, can manage Posts/Events, and receives access denied on representative CRM, finance, queue, people, and settings routes. Verify existing Marketing and Admin routes still work.

- [ ] **Step 6: Re-run database verification/advisors**

Run the current supported Supabase advisor and migration-list commands discovered through CLI help, plus `supabase/tests/preferred_web_flow_content_verification.sql`.

Expected: no security advisor finding introduced by this migration and local migration history is consistent.

- [ ] **Step 7: Inspect final diff and secrets**

Run:

```bash
git diff --check main...HEAD
git status --short
git diff --stat main...HEAD
rg -n "service_role|SUPABASE_SERVICE_ROLE|password\s*=|email\s*===" src supabase docs
```

Expected: clean diff, no accidental secrets, no hardcoded email authorization, and only scoped changes.

- [ ] **Step 8: Commit final integration fixes and documentation**

```bash
git add docs/content-marketing-provisioning.md
git commit -m "docs: add marketing content provisioning guide"
```

- [ ] **Step 9: Push only the feature branch**

Run: `git push -u origin PreferedWebFlow`

Expected: `origin/PreferedWebFlow` is created or updated; `main` is untouched.
