# Preferred Web Flow — Foundation-First Design

## Objective

Prepare the existing Hakum public website and Team Portal for a reordered marketing homepage, future GSAP/ScrollTrigger animation, managed Posts and Events, and a destination-agnostic Partnership Inquiry form.

This work is structural. It must preserve the current website's assets, imagery, color system, typography, navigation, footer, ceramic panels, PPF information, PPF packages, PPF visualizer, branches/contact ending, working behavior, and overall visual identity.

The implementation branch is `PreferedWebFlow`.

## Scope

### Included

- Recompose the public homepage from focused section components.
- Arrange the homepage sections in the approved order.
- Add semantic IDs, stable motion markers, clean component boundaries, and reduced-motion support.
- Add a public Latest Post section backed by Team Portal-managed content.
- Extend the existing Events implementation and reuse it for the public Events section.
- Add a shared hybrid media-card presentation for Posts and Events where their presentation overlaps.
- Add responsive Photos and Videos and Nano Ceramic Tint section foundations using current Hakum assets and styles.
- Add the complete responsive Partnership Inquiry UI, validation, accessible states, and a destination-agnostic submission boundary.
- Add a restricted `content_marketing` role to the existing Supabase Auth/RBAC system.
- Add `/operations/content` with Posts and Events management tabs.
- Add Supabase schema, storage, grants, and RLS foundations for managed public content.
- Keep current Admin and Operations behavior working.

### Deferred

- Final GSAP animations and ScrollTrigger timelines.
- Automatic Facebook or Instagram metadata extraction.
- Social-link scraping or synchronization.
- A live Partnership Inquiry backend destination.
- Public Partnership Inquiry inserts.
- CAPTCHA, spam protection, rate limiting, notification routing, and workflow automation.
- Unrelated Team Portal or Admin features.
- Redesigns of existing Hakum sections.

## Public Homepage

The homepage will compose the following focused sections in order:

1. Existing Hero
2. Ceramic
3. Existing PPF Information
4. PPF Packages
5. Nano Ceramic Tint
6. Videos and Photos
7. Latest Post
8. Events
9. Partnership Inquiry
10. Existing Branches / Contact / Footer ending

Stable public anchors:

- `#ceramic`
- `#ppf`
- `#tint`
- `#media`
- `#latest-post`
- `#events`
- `#partnership`

The current hero, ceramic presentation, PPF content, visualizer, queue/branch content, and public layout stay visually recognizable. Component extraction must not introduce new design language.

### Responsive behavior

- Existing desktop compositions remain intact where they already work.
- New content sections use the current public breakpoints and shell widths.
- Posts and Events can sit in a balanced desktop grid but stack into full-width cards on mobile.
- Media content uses responsive aspect ratios, lazy-loaded imagery, and touch-friendly controls.
- The Partnership Inquiry form uses two columns only where space permits and becomes a single-column form on narrow screens.
- Content controls maintain at least 44px touch targets where interactive.
- No horizontal overflow is introduced by media, cards, the PPF visualizer, or form fields.

## GSAP and ScrollTrigger Readiness

No final animation code or timeline is included.

Each major homepage section will expose:

- A stable semantic section element and ID.
- A `data-motion-section` marker.
- Optional child markers such as `data-motion="heading"`, `data-motion="media"`, `data-motion="card"`, and `data-motion="stagger-item"`.
- A component boundary that future animation code can target without moving markup between sections.

Reduced-motion behavior will be part of the foundation:

- CSS under `@media (prefers-reduced-motion: reduce)` disables nonessential transitions and scroll behavior.
- Motion markers do not hide content by default.
- Future JavaScript motion code can check `window.matchMedia('(prefers-reduced-motion: reduce)')` before registering timelines.
- The foundation remains fully usable when JavaScript animation never runs.

The GSAP package does not need to be used in this branch. Adding unused animation runtime code would provide no user value and could create invisible-content regressions.

## Managed Posts

A new `public.social_posts` table will provide the single content source for the public Latest Post section and the Team Portal Posts tab.

Proposed fields:

- `id uuid primary key`
- `platform text` constrained to supported external sources such as `facebook`, `instagram`, or `external`
- `source_url text`
- `title text`
- `excerpt text`
- `media_url text`
- `cta_label text`
- `status public.content_status`
- `published_at timestamptz`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

The shared `content_status` enum contains:

- `draft`
- `published`
- `archived`

The public homepage reads only the newest published post. When no post exists or loading fails, it renders a stable empty/fallback state without breaking the rest of the homepage.

The hybrid public card uses current Hakum styling and displays the controlled preview media, title, excerpt, platform, date, and a link to the original source.

## Existing Events Extension

The existing `public.events` table, Events page, share page, registration relationships, and planning integrations remain the foundation. No second Events table or second public source is introduced.

The Events schema will be extended only with fields needed for the approved content workflow, including:

- `status public.content_status`
- `source_url text`
- `platform text`
- `cta_label text`
- `location_text text`
- `registration_url text`
- `created_by uuid`
- `updated_by uuid`
- `published_at timestamptz`

Existing `title`, `description`, `banner_url`, `branch`, `starts_at`, `ends_at`, `slug`, `form_id`, `created_at`, `updated_at`, and `is_published` behavior is preserved.

`status` becomes the managed-content state while `is_published` remains temporarily compatible with existing Events queries and controls. A migration will backfill `status` from `is_published`, and compatibility logic will keep legacy publish toggles and new status edits synchronized during this transition.

The public homepage shows the next relevant published Event. When none is available, it shows the approved existing-style message:

> No published events yet. Check back soon.

The standalone Events page continues to work and consumes the same records.

## Media Storage

Managed Posts and Events may use uploaded media or external media URLs.

A dedicated public content-media storage foundation will be created. Storage policies will allow public reads of published media while permitting authenticated content managers to upload, select, update, and delete only within the intended content bucket/path. Upsert support must include the required INSERT, SELECT, and UPDATE permissions.

The frontend never receives a Supabase service-role or secret key.

## Team Portal Content Area

The existing Team Portal login, `AuthProvider`, staff profile lookup, operations shell, protected routes, and centralized permissions remain authoritative.

The new authentication flow is:

Team Portal Login → Supabase Auth → resolve `staff_profiles.role` → `content_marketing` → redirect to `/operations/content`.

The login email identifies the Supabase Auth user only. No frontend or RLS decision is based on the email address.

### Role

- Database value: `content_marketing`
- Display name: `Marketing Content`
- Default landing route: `/operations/content`

This role is intentionally separate from the existing `marketing` role because the existing role has broader CRM access. Separating the role prevents regressions for existing Marketing/CRM users and provides a narrow authorization boundary.

### Content workspace

`/operations/content` contains:

- Posts tab
- Events tab

The workspace supports, within the approved content tables:

- List and view
- Create
- Edit
- Save as draft
- Publish and unpublish
- Archive
- Delete where permitted
- Manage media and external links

Content permission checks will be centralized in the existing RBAC module, including helpers such as `canAccessContent`, `canManagePosts`, and `canManageEvents`. Route visibility and route access use the same helpers.

Manual navigation to unrelated Operations or Admin routes is blocked by the existing protected-route layer. Hidden navigation is not treated as authorization.

### Account provisioning

The branch will not hardcode or automatically create a real login email. The intended Auth user is created through the existing Supabase account-provisioning process, then assigned a `staff_profiles` row with role `content_marketing`. A documented, auditable provisioning step will be supplied.

## Supabase RLS and Grants

All new or extended public-schema tables have RLS enabled.

Policy intent:

- `anon` and normal authenticated visitors can read published Posts and published Events only.
- `content_marketing` can read and manage Posts and Events.
- `content_marketing` cannot access CRM, finance, customers, bookings, queue, staff, settings, or Admin data through this feature.
- Existing elevated roles may retain oversight only where the current RBAC model already grants it.
- Draft and archived content never appears through public read policies.
- UPDATE policies include both `USING` and `WITH CHECK`.
- Authorization uses the existing server-derived role helpers, not `user_metadata` and not email comparisons.
- Required Data API table privileges are granted explicitly; RLS remains the row-authorization boundary.

The migration will extend the existing role enum and helper patterns rather than introducing a second authorization system.

## Partnership Inquiry

The responsive form fields are:

- Name
- Email
- Contact Number
- City
- Message

The component includes:

- Labels associated with inputs.
- Client-side required-field validation.
- Email-format validation.
- Accessible field-level errors and an error summary/status region.
- Submission states: `idle`, `validating`, `submitting`, `success`, `error`, and `unavailable`.
- Disabled controls during submission states.
- Current Hakum styling on desktop and mobile.

The form calls a destination-agnostic service boundary named `submitPartnershipInquiry(payload)`. Its payload shape is reusable and contains normalized values for the five fields.

For this branch, the adapter returns a typed `unavailable` result. The UI explains that online partnership inquiries are not yet accepting submissions and does not transmit user data anywhere.

The component must not import Supabase, call an API route, send email, invoke a webhook, or write directly to any backend. A later adapter can change the destination without rewriting the UI.

## Data Flow

### Public content

Marketing Content user → Team Portal Auth → `/operations/content` → Supabase RLS-authorized content mutation → published content query → public Latest Post or Events section.

There is one source of truth for each content type. No separate hardcoded public post/event list is maintained after the CMS-backed sections are active.

### Partnership Inquiry

Visitor input → client validation → normalized inquiry payload → `submitPartnershipInquiry` abstraction → typed unavailable response in this branch.

No network transmission occurs in the foundation implementation.

## Failure and Empty States

- Latest Post query failure: show a restrained unavailable/empty state; do not fail the homepage.
- No published Posts: show a purpose-built Latest Post empty state.
- No published Events: show “No published events yet. Check back soon.”
- Broken or missing content media: render a current Hakum fallback surface and keep text/CTA usable.
- Unauthorized content route: use the existing forbidden-route behavior.
- Expired session: use the existing login/session flow.
- Content save failure: preserve the editor values and display an actionable error.
- Partnership submission: remain in the explicit unavailable state without transmitting data.
- Reduced-motion preference: content remains visible and usable without motion.

## Accessibility

- Semantic headings follow the page hierarchy.
- New sections have meaningful labels and anchors.
- Media includes useful alt text or is marked decorative.
- Tabs, forms, dialogs, and status messages are keyboard accessible.
- Focus is visible and follows existing UI conventions.
- Errors are announced and associated with their fields.
- Color is not the only indicator of status.
- Motion preparation never makes content unavailable to reduced-motion users.

## Verification Strategy

### Application checks

- Existing lint and production build commands.
- Homepage render and route smoke checks.
- Desktop and mobile checks at representative breakpoints.
- Keyboard and focus checks for content tabs and Partnership form.
- Tests for form normalization, validation, and unavailable adapter behavior.
- Tests for public content selection and empty states.
- Tests for centralized `content_marketing` navigation and route decisions.

### Database checks

- Migration applies cleanly to the existing schema.
- RLS is enabled on new content tables.
- Anonymous users can read published content and cannot read draft or archived content.
- `content_marketing` can manage Posts and Events.
- `content_marketing` is denied unrelated Operations/Admin data.
- Existing Marketing/CRM and Admin/Operations behavior remains unchanged.
- Storage read and content-manager write policies behave as designed.
- No service-role key or unsafe user-metadata authorization appears in client code.

## Delivery

The implementation will be committed and pushed only to `PreferedWebFlow`. It will not be merged into `main` as part of this task.
