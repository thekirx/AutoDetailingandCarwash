# Preferred Homepage Production Transplant Design

## Objective

Reproduce the customer-facing homepage design from `acfcec6` on `PreferedWebFlow` on top of the complete current production code at `main`, while preserving production behavior, routes, backend integrations, schema, permissions, and data flows.

This is a manual frontend design transplant. The reference branch must not be merged, promoted, or cherry-picked wholesale.

## Source and Delivery Boundaries

- Implementation base: latest `origin/main`, verified as `caba6f2` on 2026-08-16.
- Visual reference: `acfcec6` on `PreferedWebFlow`.
- Working branch: `codex/preferred-homepage-transplant`.
- Delivery target: a new Vercel preview deployment only.
- Production aliases, `main`, and the production deployment must not be changed.

The production repository and existing Supabase schema remain authoritative. Reference-branch database migrations, RBAC changes, marketing roles, content-management pages, RLS policies, APIs, and functions are excluded.

## Homepage Architecture

The public homepage will be recomposed into focused presentational sections in this order:

1. Hero
2. Ceramic
3. PPF Information
4. PPF Packages
5. Nano Tint
6. Media
7. Latest Post
8. Events
9. Partnership
10. Branches

The current About and general Services sections will be removed. Their full layouts will not be relocated. Only copy that materially improves another retained section may be reused.

The transplant will follow current production routing, shared UI primitives, header/footer behavior, responsive conventions, and data hooks. New homepage components will be presentational wherever practical so data and navigation behavior remain separate from the reference styling.

## Section Behavior

### Hero and Ceramic

Use the reference hierarchy, spacing, typography, imagery, and responsive composition. Ceramic continues to consume existing production package data. The Classic tier remains absent, matching the approved reference; Premium and Platinum stay in their existing order with their current customer-facing content.

### PPF Information

Introduce PPF with the reference's black technical stage, safe headline, four feature callouts, Hakum imagery, and responsive linework. Decorative elements must be hidden from assistive technology and must not cause horizontal overflow.

### PPF Packages

The customer homepage will no longer import, lazy-load, or render `PPFVisualizer`.

Existing PPF package information currently owned by the production visualizer/data model will be exposed through a reusable static package-card model. Each card contains:

- an intentional visual placeholder;
- package name;
- existing description;
- existing coverage, protected areas, inclusions, benefits, and pricing text where already present;
- an existing production-safe CTA destination.

No package claims or prices will be invented. Placeholder visuals will be separate from package copy so they can later be replaced by photography, coverage graphics, or video without rebuilding the cards.

Visualizer-only runtime loading will be removed from the homepage bundle when it can be done without affecting other routes.

### Nano Tint and Media

Use the reference composition and existing Hakum assets. Headings and media must remain contained at desktop, tablet, and mobile widths. Media remains lazy loaded and does not introduce new data sources.

### Latest Post

Use the reference card presentation with production `blogs` as the source of truth. The homepage selects the latest published production Blog record using the existing production fields and routes to the existing `/blog/:slug` experience. It must not query the reference branch's `social_posts` schema.

Loading, empty, missing-media, and query-error states remain non-blocking and do not fail the homepage.

### Events

Use the reference event-card presentation with production `events` as the source of truth. Existing production event fields, publication logic, and `/events/:slug` route remain authoritative. No preview-specific event schema fields are required.

Loading, empty, missing-media, and query-error states remain non-blocking.

### Partnership

Render the reference form presentation with Name, Email, Contact Number, City, and Message fields. Client-side field validation and accessible feedback may be retained, but submission remains explicitly unavailable and sends no network request because production has no verified destination for this inquiry.

The UI uses a small adapter boundary so a future backend can be connected without rebuilding the form. No Supabase table, API, webhook, email action, function, role, or permission will be created.

### Branches

Continue to render production branch data and routes. Append a static, non-clickable `Dasmariñas, Cavite` card with visible `Coming Soon` status. This card is not counted as an active branch and does not require a database record or migration.

## Preserved Production Functionality

The transplant must leave these systems behaviorally unchanged:

- customer accounts and authentication;
- booking and queue;
- Blog and Events routes and data;
- PWA installation and service worker behavior;
- notifications and push configuration;
- APIs and Vercel functions;
- Supabase integration, schema, permissions, and RLS;
- production navigation and public routes;
- internal, Operations, and Admin routes.

In shared conflict files, production behavior wins. Reference markup and CSS are manually adapted around current code rather than replacing whole files.

## Responsive and Accessibility Requirements

Validate desktop, tablet, and mobile presentations, with particular attention to hero scaling, package-card wrapping, ceramic layout, PPF linework, Nano Tint headings, media ratios, content cards, Partnership fields, branch-card containment, navigation, CTA touch targets, and section rhythm.

Requirements:

- no page-level horizontal overflow;
- logical heading order and semantic section labels;
- meaningful image alternatives or decorative treatment;
- keyboard-accessible controls and visible focus;
- form errors associated with their fields and announced;
- touch targets of at least 44px where practical;
- reduced-motion users receive fully visible content;
- mobile layouts do not depend on hover.

## Data Flow

### Blog and Events

Homepage mount -> existing Supabase client -> production `blogs` and `events` queries -> normalize production records into presentational card props -> render preferred cards -> navigate through existing production routes.

### Branches

Existing `usePublicBranches` hook -> active production branch cards -> append static Dasmariñas coming-soon card.

### Partnership

Visitor input -> client validation -> typed unavailable adapter result -> visible unavailable state. No visitor data leaves the browser.

## Error Handling

- Blog or Events query failure: render a restrained unavailable/empty state; do not fail the homepage.
- Missing media: render the intentional card fallback while keeping text and CTA available.
- Empty branch query: keep the existing Bacoor and Batangas fallbacks, then append Dasmariñas.
- Partnership submission attempt: show the explicit unavailable response and preserve entered values.
- Homepage component failure must not alter authentication, routing, or internal application shells.

## Verification

Before deployment:

1. Run the complete production test suite and production build.
2. Add focused tests for section order, removal of About/Services, absence of the visualizer, static PPF package content, production Blog/Event queries and routes, Partnership no-network behavior, and Dasmariñas non-link behavior.
3. Smoke-check homepage, authentication, customer account, booking, queue, Blog, Events, Admin/internal routes, APIs, PWA, and notifications.
4. Render-check desktop, tablet, and mobile widths for overflow, clipping, spacing, headings, cards, CTAs, and navigation.
5. Compare the preview with `acfcec6`, recording intentional deviations caused by preserving production behavior.

After local verification, deploy the working branch to a new Vercel preview. Do not promote it, attach production aliases, merge it into `main`, or deploy with the production target.

## Explicit Exclusions

- Supabase migrations or schema changes
- `content_marketing` or other new roles
- RBAC, permission, grant, or RLS changes
- marketing/content-management portals
- preview-specific APIs or database functions
- direct branch merge, cherry-pick, or Vercel promotion
- production deployment or production alias changes

