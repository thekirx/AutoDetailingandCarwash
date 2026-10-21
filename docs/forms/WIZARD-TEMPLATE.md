# Wizard form template — analysis and design

Status: **mock APPROVED by Kirk, option B** (17 Oct 2026)
(`design-mocks/wizard-form-template-2026-10-17/index.html`). Build steps for whoever implements it:
[`WIZARD-TEMPLATE-IMPLEMENTATION.md`](WIZARD-TEMPLATE-IMPLEMENTATION.md). Option B also needs the
`can_submit_ops_form` RLS function to learn `custom` — the SQL in the mock shows only the constraint;
the implementation plan has the full migration.

## 1. The wizards the app already has

| Wizard | Where | Steps | Progress | Back / next | Per-step check | Summary | Finish |
|---|---|---|---|---|---|---|---|
| Customer booking | `src/pages/CustomerBookPage.jsx` | package? → car → when → review (list built per service) | "Step 2 of 4" + segmented bar (`.capp-flow-bar`), big "02" numeral | back arrow in the header, one full-width Continue; last step says Send | `stepReady` per step disables Continue | `dl.capp-sum` (Service, Package, Car, When, Branch, Price) on the review step | toast + "Booking requested" done screen |
| Tint Finder | `src/components/public/TintFinder.jsx` | 4 fixed questions → results | "Step 1 of 4" label + `role="progressbar"` segments | Back (ghost) + Continue; last says "See my matches" | Continue disabled until a choice is picked | `.tf-answer-summary` chips of every answer | results + booking request → status message |
| Customer sign-up | `src/pages/CustomerSignUpPage.jsx`, rules in `src/lib/customerOnboarding.js` | phone → you & car → birthday → password (`ONBOARDING_STEPS`) | numbered `<ol>` with is-current / is-done | Back + Continue; last says "Create account" | `validateOnboardingStep(stepId, draft)` runs on Continue, shows the first error | none (short form) | signs in, lands in the app |
| Ops New ticket | `NewQueueTicketPage` in `src/pages/OperationsPages.jsx` (+ `NewTicketWizard.css`) | vehicle → services → review | clickable numbered steps, `aria-current="step"` | Back + Next; jump ahead only past completed steps | `stepError(i)` per step; Submit re-checks every step | review step | ticket created |
| Public `/f/:slug` forms | `src/pages/PublicFormPage.jsx` → `src/components/BrandedOpsForm.jsx` | **none — one long page** | none | single Submit | `validatePayload` on submit only | none | "Thank you" block |

## 2. The shared pattern

Every wizard above does the same six things; only the content differs:

1. **Steps are data.** An ordered list of `{ id, label/title, hint }`, and each input belongs to one step.
2. **Progress** is "Step N of M" text plus a segmented bar (filled up to the current step). Screen readers get `role="progressbar"` or `aria-current="step"`.
3. **One step on screen.** Title + one-line hint, then that step's inputs only.
4. **Back / Continue.** Back is quiet and hidden on step 1; Continue is the one primary button. Its label changes on the last step (Send / Create account / See my matches).
5. **Per-step validation.** Continue checks only the current step's fields and shows the first problem. Submit re-checks everything (the server checks again).
6. **Review, then thank-you.** The last screen lists the answers (`dl` rows) with a way back to fix one; after submit a thank-you screen replaces the form.

## 3. How forms are stored today

- Table `public.ops_forms`: `name, kind, slug, description, fields jsonb, settings jsonb, status (draft|published|archived), public_enabled, is_active, event_id`.
- `fields` is an array of `{ key, label, type, required, options }`. Types: text, textarea, email, phone, number, date, datetime, select, checkbox (`FIELD_TYPES` in `src/lib/opsForms.js`).
- `settings` is a free JSON object (`show_logo, logo_url, header_title, slug_locked, push_to_planning, show_on_calendar`), normalised by `normalizeFormSettings`.
- Public read/write go through `get_public_ops_form(slug)` (returns `fields` + `settings` as stored) and `submit_public_ops_form(slug, payload)` (checks `required` keys, saves to `ops_form_submissions`). Extra keys on a field or in `settings` pass through untouched.
- `kind` is limited by `ops_forms_kind_check` to complaint, event, equipment_repair, cash_advance, detailing. The four fixed kinds are edit-only; the Planner → Forms tab can only **create** `detailing` forms ("+ New detailing form").

## 4. Proposed design (no parallel system)

**A wizard is an ordinary `ops_forms` row with steps switched on.**

- `settings.layout = 'wizard'` (missing or `'page'` = today's single page, so every existing form is unchanged).
- `settings.steps = [{ id, title, hint }]` in order.
- Each field gains an optional `step` (a step id). Fields without one fall into the first step. `normalizeFields` keeps `step`; the database functions ignore it, so **no SQL change is needed for steps**.
- `settings.review = true` adds the automatic "Check and send" screen; `settings.thank_you = { title, body }` sets the finish screen text.

**Template.** A code constant `WIZARD_FORM_TEMPLATE` in `src/lib/opsForms.js`, next to `templateFields`: 3 steps (About you → Your car → Your request) + review, with generic fields an admin renames. The Forms tab shows it in a "Start from a template" row; **Use this template** opens the existing editor dialog pre-filled as a new draft (same path as "+ New detailing form"). Saving inserts a normal row with its own slug, `/f/<slug>` link and QR.

**Editor.** The existing dialog gets a "Show as steps" switch. When on, a Steps list (rename, hint, add, remove, reorder) appears above Fields, and each field row gets a "Step" dropdown. Preview shows the wizard.

**Renderer.** `BrandedOpsForm` keeps its shell (navy hero, logo, card). When `layout === 'wizard'` the body renders the shared pattern from section 2 — progress, one step, Back/Continue, per-step `validatePayload` on that step's fields, review `dl` with "Edit" links, legal checkbox on the last screen, then the thank-you. Pure step logic lives in a small `src/lib/formWizard.js` so it is unit-tested without a browser. Staff "Fill a form" in the Planner keeps the single-page layout.

**Open decision — the `kind` of a copied form.** The only kind the tab can create is `detailing`, so a copy for "any purpose" would show under *Detailing services*, get the purple "Detailing" Planner label and the "Detailing: …" card title.
- **A (no database change):** copies are `detailing` forms. Works today; mislabelled for non-detailing uses.
- **B (recommended):** one small migration adds a `custom` kind (the Sept smart-forms migration already allowed `custom`), and the picker gets "Custom forms". Needs Kirk to run the SQL on the live project; nothing is applied without his OK.
