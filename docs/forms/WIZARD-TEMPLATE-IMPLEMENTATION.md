# Wizard form template — implementation plan

**Status:** design APPROVED by Kirk on 17 Oct 2026, **option B** ("Custom forms" kind).
This plan is written for an AI (or developer) who has not seen the earlier conversation.
Follow it top to bottom. Build and check on **localhost only**. Do not commit or push until Kirk says so.

- Approved mock: [`design-mocks/wizard-form-template-2026-10-17/index.html`](../../design-mocks/wizard-form-template-2026-10-17/index.html)
  (open it through the "mocks" dev server: `http://localhost:4321/wizard-form-template-2026-10-17/index.html`, or the file directly; the fonts and logo load only when it is served).
- Analysis and design notes: [`docs/forms/WIZARD-TEMPLATE.md`](WIZARD-TEMPLATE.md) (the app's existing wizards, the shared pattern, how forms are stored).

---

## 0. Repo rules (read first)

1. **Shared checkout.** Kirk, Codex and other Claude sessions all work in `/Users/kiro/Desktop/AutoDetailingandCarwash` on `main`. Do not switch branches, stash, reset, or `git checkout --` anything.
2. **CHANGES.log.** Read the tail of `CHANGES.log` before you start. At the end of every working turn, append a dated line saying what you changed and what is still uncommitted.
3. **Other people's work in progress.** At the time of writing, many files have uncommitted changes that are **not yours**: the PPF section (`src/components/public/home/PpfPackagesSection.*`), the referral / birthday work (`server/referral.mjs`, `src/lib/referral.js`, `src/pages/Refer*`, `supabase/migrations/20261018120000_refer_a_friend.sql`, …), `src/App.jsx`, `src/lib/notificationTemplates.js`, `tests/publicBranding.test.js`, `tests/bredesignPublicPages.browser.test.js` and others. Run `git status` before you start and write down that list. Do not edit, format, stage or revert any of those files. None of the files this plan touches should be on that list. If one is, stop and ask Kirk.
4. **Database.** Add the migration file (section 2) to the repo, but **never apply it to the live Supabase project**: no `supabase db push`, no `apply_migration` or `execute_sql` MCP call, no SQL editor. Kirk runs it himself. Give him the SQL in your report.
5. **No commit, no push** until Kirk says so in his own words. "Proceed" means "keep building the approved design"; it does not mean commit or push.
6. **Mocks before code.** This design is approved. If you find you need a visual change the mock does not show, make a small before/after mock in `design-mocks/` and ask first.

---

## 1. What you are building (summary)

In the Ops console, **Planner → Forms** tab (`/operations/planning`, Forms tab, component `src/pages/planning/PlanningFormsSmartPanel.jsx`):

1. A **"Start from a template"** row under the "Which form" picker, with one card: **Step-by-step form** (Wizard pill, step chips About you → Your car → Your request → Check and send), buttons **Use this template** (primary) and **Preview**.
2. **Use this template** opens the **existing** Create dialog, pre-filled as a **Draft** of kind **Custom form**. Saving inserts a normal `ops_forms` row with its own slug, `/f/<slug>` link and QR.
3. A new **Custom forms** entry in the "Which form" picker lists those forms (with the same Preview / Results / Edit / Archive / link / QR card that detailing forms have), plus a **＋ New custom form** button.
4. The editor gets a **Show as steps** switch, a **Steps** list (title, hint, ↑ ↓ ✕, ＋ Add step, "End with a Check and send screen" tick), a **Thank-you message** input, and a **Step** dropdown on every field. Fields are grouped under their step.
5. The public page `/f/:slug` (`PublicFormPage` → `BrandedOpsForm`) shows a wizard when the form has steps on: "Step N of M" + segmented bar, big "01" numeral, step title + hint, that step's fields only, Back / Continue, per-step validation, a **Check and send** review screen with an **Edit** link per step (the Terms tick sits there), then a **Thank you** screen with the editor's text.
6. Planner cards created from a custom form get a **grey** label "Custom" and the title `<form name>: <respondent>`.

Forms without steps switched on render exactly as today. Existing forms must not change.

---

## 2. Database: the `custom` kind (option B)

Create **`supabase/migrations/20261018150000_ops_forms_custom_kind.sql`** (if that timestamp is taken or older than the newest file in `supabase/migrations/`, use a newer one; keep the `_ops_forms_custom_kind.sql` suffix):

```sql
-- Option B (wizard form template, approved 17 Oct 2026):
-- allow a 'custom' kind so admins can create general-purpose forms in Planner → Forms.
-- Widens the check constraint only; no rows change. Kirk applies this by hand.

begin;

alter table public.ops_forms drop constraint if exists ops_forms_kind_check;
alter table public.ops_forms
  add constraint ops_forms_kind_check
  check (kind in (
    'complaint',
    'event',
    'equipment_repair',
    'cash_advance',
    'detailing',
    'custom'
  ));

-- Staff fill + read of published forms goes through can_submit_ops_form(kind)
-- (ops_forms_select and ops_form_submissions_insert policies). Give 'custom'
-- the same roles as 'detailing'; every other branch is copied unchanged from
-- 20261009150000_planner_rls_match_app.sql.
create or replace function public.can_submit_ops_form(p_kind text)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $$
  select case p_kind
    when 'equipment_repair' then public.current_user_role() = 'staff'
    when 'cash_advance' then public.current_user_role() in
      ('staff', 'detailer', 'team_lead', 'operations_lead', 'admin', 'assistant_super_admin')
    when 'complaint' then public.current_user_role() in
      ('BossMich', 'assistant_super_admin', 'admin', 'operations_lead', 'staff', 'team_lead', 'marketing', 'video_editor')
    when 'event' then public.current_user_role() in
      ('BossMich', 'assistant_super_admin', 'admin', 'operations_lead', 'staff', 'team_lead', 'marketing', 'video_editor')
    when 'detailing' then public.current_user_role() in
      ('BossMich', 'assistant_super_admin', 'admin', 'operations_lead', 'staff', 'team_lead', 'marketing', 'video_editor')
    when 'custom' then public.current_user_role() in
      ('BossMich', 'assistant_super_admin', 'admin', 'operations_lead', 'staff', 'team_lead', 'marketing', 'video_editor')
    else false
  end;
$$;

revoke all on function public.can_submit_ops_form(text) from public, anon;
grant execute on function public.can_submit_ops_form(text) to authenticated;

commit;
```

Before you write the file, open `supabase/migrations/` and find the **newest** migration that defines `public.can_submit_ops_form` (`grep -ln "function public.can_submit_ops_form" supabase/migrations/*.sql`). On 18 Oct that was `20261009150000_planner_rls_match_app.sql`. If a newer one exists, copy its branches instead and add only the `'custom'` line — never drop a role someone else added.

Notes:
- `get_public_ops_form` and `submit_public_ops_form` (in `20260727020000_smart_ops_forms.sql`) are `security definer` and do not look at `kind`, so the public `/f/:slug` fill works for `custom` once the constraint allows the row. They return `fields` and `settings` exactly as stored, so the step data in section 3 passes through untouched.
- Signed-in staff are different: the `ops_forms_select` and `ops_form_submissions_insert` policies call `can_submit_ops_form(kind)`, which returns `false` for unknown kinds. That is why the migration also updates that function. Planner editors (`can_edit_planning()`) and admins are not affected by it.
- The app-side mirror is `canSubmitOpsFormKind` in `src/auth/permissions.js` (section 4.7); keep the two in step.
- **Until Kirk runs this SQL, saving a custom form fails on the live database** with a check-constraint error. That is expected. The UI must show the error toast (the existing `toast.error(error.message)` path does this). Do not work around it by saving as `detailing`.

---

## 3. Data shape (no other schema change)

A wizard is an ordinary `ops_forms` row. All wizard data lives in the existing `settings` and `fields` JSON columns.

```js
// ops_forms.settings (added keys; existing keys unchanged)
{
  layout: 'wizard',            // missing or 'page' = today's single page
  steps: [                     // ordered; ids are stable strings, never shown
    { id: 'about',   title: 'About you',    hint: 'So we know who to reply to' },
    { id: 'car',     title: 'Your car',     hint: 'Plate and branch' },
    { id: 'request', title: 'Your request', hint: 'Tell us what you need' },
  ],
  review: true,                // adds the "Check and send" screen as the last step
  thank_you: {                 // empty strings fall back to the defaults below
    title: 'Thank you',
    body: 'Thanks! We got your answers and will message you within the day.',
  },
}

// each item in ops_forms.fields gains an optional `step`
{ key: 'plate', label: 'Plate / conduction', type: 'text', required: true, options: [], step: 'car' }
```

Rules:
- A field whose `step` is missing or not in `settings.steps` belongs to the **first** step.
- A wizard with zero steps renders as a single page.
- Default thank-you (also used for non-wizard forms, which keep their current text): title "Thank you", body "Your response was submitted. Our team will follow up if needed." — that is today's text in `BrandedOpsForm.jsx`, keep it.

---

## 4. File-by-file changes

### 4.1 `src/lib/opsForms.js`

1. `FORM_KINDS`: append `{ value: 'custom', label: 'Custom forms' }`.
2. Add `isCustomFormKind(kind)` → `kind === 'custom'`, and `isCreatableFormKind(kind)` → `kind === 'detailing' || kind === 'custom'`.
3. `formKindLabel`: keep using `FORM_KINDS`; the editor's Kind box should read **"Custom form"** (singular, as in the mock). Add `formKindSingular(kind)` that returns `'Custom form'` for custom and `formKindLabel(kind)` otherwise, and use it in the editor dialog title + Kind box.
4. `normalizeFields`: keep an optional `step` (trimmed string; omit the key when empty) on each field. Do not add any other keys.
5. `defaultFormSettings(kind)`: `show_on_calendar` true for `event`, `detailing`, and `custom` (custom forms often have a date). Leave everything else.
6. `normalizeFormSettings`: normalise the new keys:
   - `layout`: `'wizard'` only if `raw.layout === 'wizard'`, else `'page'`.
   - `steps`: array of `{ id, title, hint }`, `id` = non-empty string (generate `step_<n>` if missing, de-duplicate), `title` trimmed (fallback `Step <n>`), `hint` trimmed string.
   - `review`: `raw.review !== false` when layout is wizard; `false` otherwise.
   - `thank_you`: `{ title, body }` trimmed strings (empty allowed; renderer applies defaults).
7. Add the template constant (field keys must stay as written — `customer_name`, `phone`, `branch` are read by `submissionTitle`, `withLiveBranchOptions` and the respondent label logic):

```js
export const WIZARD_FORM_TEMPLATE = {
  id: 'wizard',
  title: 'Step-by-step form',
  blurb: 'One question group per screen, Back / Continue, a check-and-send screen, then a thank-you. Use it for sign-ups, quotes, surveys, applications.',
  kind: 'custom',
  name: 'Step-by-step form',
  description: 'Answer a few quick questions. It takes about a minute.',
  settings: {
    layout: 'wizard',
    review: true,
    steps: [
      { id: 'about', title: 'About you', hint: 'So we know who to reply to' },
      { id: 'car', title: 'Your car', hint: 'Plate and branch' },
      { id: 'request', title: 'Your request', hint: 'Tell us what you need' },
    ],
    thank_you: {
      title: 'Thank you',
      body: 'Thanks! We got your answers and will message you within the day.',
    },
  },
  fields: [
    { key: 'customer_name', label: 'Full name', type: 'text', required: true, step: 'about' },
    { key: 'phone', label: 'Mobile number', type: 'phone', required: true, step: 'about' },
    { key: 'email', label: 'Email', type: 'email', required: false, step: 'about' },
    { key: 'plate', label: 'Plate / conduction', type: 'text', required: true, step: 'car' },
    { key: 'car_model', label: 'Car make and model', type: 'text', required: false, step: 'car' },
    { key: 'branch', label: 'Preferred branch', type: 'select', required: true, options: [], step: 'car' },
    { key: 'request_type', label: 'What do you need?', type: 'select', required: true, options: ['Option A', 'Option B', 'Option C'], step: 'request' },
    { key: 'preferred_date', label: 'Preferred date', type: 'date', required: false, step: 'request' },
    { key: 'notes', label: 'Anything else?', type: 'textarea', required: false, step: 'request' },
  ],
}

export const FORM_TEMPLATES = [WIZARD_FORM_TEMPLATE]
```

   Export a helper `draftFromTemplate(template, { branchSlugs })` that returns a deep copy shaped like the editor state: `{ id: null, kind, name, description, status: 'draft', public_enabled: true, event_id: '', fields: withLiveBranchOptions(template.fields, branchSlugs), settings: normalizeFormSettings({ ...template.settings, slug_locked: false }, kind), slug: '' }`. Mutating the draft must never change `WIZARD_FORM_TEMPLATE` (test this).
8. `templateFields('custom')`: return the template's fields (used by `emptyEditorFromForm` when a custom form has no fields).
9. `submissionTitle`: for `custom` return `` `${form?.name || 'Form'}: ${name || 'Submission'}` `` (the existing fallback already does this; make sure no earlier branch catches custom).

### 4.2 `src/lib/formWizard.js` (new, pure, no React)

All step logic lives here so it is unit-tested without a browser:

```js
isWizardForm(form)                  // normalizeFormSettings(form.settings, form.kind).layout === 'wizard' && steps.length > 0
wizardSteps(form)                   // [{ id, title, hint, fields: [...normalizedFields] }] — fields grouped by `step`, unknown/missing → first step; empty steps kept (render "No questions in this step yet.")
wizardScreens(form)                 // steps + (review ? [{ id: '__review', title: 'Check and send', hint: 'Tap Edit to change anything.', fields: [] }] : [])
validateStep(step, values)          // validatePayload(step.fields, values) — returns string[]
firstInvalidStep(steps, values)     // index of the first step with errors, or -1 (used on final Send)
answerRows(step, values)            // [{ key, label, value }] for the review list: skip empty answers; checkbox → 'Yes'; date → 'Sat, 24 Oct 2026' (en-PH); datetime → date + time; select/text as is
```

### 4.3 `src/components/BrandedOpsForm.jsx`

Keep the shell (hero, logo, eyebrow, kind, title, lead, preview badge, alert). Inside `.hakum-form-body`:

- If `!isWizardForm(form)`: today's markup, unchanged — except the success block uses `settings.thank_you.title/body` when set, falling back to today's text.
- If wizard: render a new `WizardBody` (same file or `src/components/BrandedOpsWizard.jsx`) with props `{ form, values, onChange, onSubmit, status, error, preview, footerSlot }`:
  - Local state `index` (current screen). Reset to 0 when `form.id`/`form.slug` changes.
  - **Progress:** `<div class="wz-prog"><span><b>Step {index+1}</b> of {screens.length}</span><span>{screen.title}</span></div>` and a segmented bar `<div class="wz-bar" role="progressbar" aria-valuemin="1" aria-valuemax={n} aria-valuenow={index+1} aria-label="Form progress" style="--n:n">` with `<i class="on">` up to the current screen.
  - **Heading:** numeral `01`, `02`… (`.wz-num`, hidden on the review screen), `<h2 class="wz-h" tabIndex={-1}>` title (move focus to it on every step change), hint `<p class="wz-hint">`.
  - **Fields:** the same input markup as the single-page form (extract the existing per-field JSX into a `FormField` component in `BrandedOpsForm.jsx` and use it in both modes — do not duplicate it). Required asterisk as today.
  - **Per-step validation:** Continue runs `validateStep`. On errors: don't advance; mark the offending inputs `aria-invalid="true"` + class `is-invalid` (red border, `.fi.err` look in the mock), show the message under the field (`.hakum-form-field-error`, e.g. "Preferred branch is required" — reuse the `validatePayload` text), and focus the first invalid input. Errors for a field clear when its value changes.
  - **Buttons:** `.wz-act` grid: Back (`.wz-back`, quiet, hidden on the first screen) + primary (`.hakum-form-submit`). Primary label: "Continue" on step screens, "Send" on the last screen (review screen, or the last step when `review` is false). Enter in a text input = Continue (the `<form onSubmit>` does this; on non-last screens it must advance, not submit).
  - **Check and send:** one `<section>` per step (`.wz-sum`), header with the step title + an **Edit** button (`type="button"`, `aria-label="Edit {title}"`) that jumps to that step; a `<dl>` from `answerRows`; then `footerSlot` (the Terms checkbox from `PublicFormPage`), then Back + Send. If `review` is false, `footerSlot` goes under the last step's fields.
  - **Send:** call `firstInvalidStep`; if any, jump there and show its errors; else `onSubmit()`. `PublicFormPage.onSubmit` already re-validates all fields and checks the Terms tick; keep that.
  - **Thank-you** (`status === 'success'`): full bar, green tick circle (`.wz-done .ok`, `aria-hidden`), `<h2>` = `thank_you.title || 'Thank you'`, `<p>` = `thank_you.body || <today's text>`, and if the parent passes `submissionId`, show `Reference XXXX-XXXX` (first 8 hex chars of the id, upper case, split 4-4). Add an optional `submissionId` prop to `BrandedOpsForm`; `PublicFormPage` passes `data?.id` from the RPC result (store it in state).
  - **Preview mode** (`preview` true, used by Planner Preview): inputs disabled as today, but Back / Continue / Edit **work** so the admin can click through every screen; Send is disabled with the existing "Submit (preview only)" wording → use "Send (preview only)"; no validation blocking in preview.
  - `prefers-reduced-motion`: no step slide animation (a 150 ms fade is fine otherwise).

### 4.4 CSS — `src/styles.css`, in the "Branded public / preview ops forms" block (around the `.hakum-form-*` rules, ~line 5175)

Port these classes from the mock's `<style>` (names and values as in the mock): `.wz-prog`, `.wz-bar`, `.wz-bar i`, `.wz-bar i.on`, `.wz-num`, `.wz-h`, `.wz-hint`, `.wz-act`, `.wz-back`, `.wz-sum` (+ `section`, `header`, `header button`, `dl`, `dt`, `dd`), `.wz-done` (+ `.ok`, `h2`, `p`), `.wz-ref`, `.hakum-form-field .is-invalid`, `.hakum-form-field-error`. Scope them under `.hakum-form-shell` so nothing else is affected. Fonts: the numeral uses the site display font (`var(--font-display), 'Benzin', sans-serif`), as in the mock. Touch targets ≥ 44 px (Back, Edit, Continue). At ≤ 380 px the review `dl` becomes one column (label above value).

### 4.5 `src/pages/PublicFormPage.jsx`

- Keep the data flow. Store the RPC's returned id: `setSubmissionId(data?.id || null)` and pass `submissionId` to `BrandedOpsForm`.
- After success, do **not** reset to step 1 in a way that hides the thank-you (the success state wins).
- Notify call: unchanged (it only fires for `complaint`).

### 4.6 `src/pages/planning/PlanningFormsSmartPanel.jsx` (the Forms tab)

1. **Imports:** `FORM_TEMPLATES`, `draftFromTemplate`, `isCustomFormKind`, `isCreatableFormKind`, `formKindSingular` from `@/lib/opsForms`.
2. **Lists:** generalise `detailingForms` / `selectedDetailingId` to "creatable forms of the current kind": `creatableForms = forms.filter((f) => f.kind === kindFilter)` when `isCreatableFormKind(kindFilter)`, and rename the state to `selectedFormId`. `selectedTemplate` uses that list for both `detailing` and `custom`. Keep behaviour for detailing identical.
3. **"Which form" picker:** "Custom forms" appears automatically from `FORM_KINDS`. The `.in('kind', FORM_KINDS…)` query picks up custom rows.
4. **Start from a template row** (only when `manageTemplates`): render under the picker, above the "＋ New … form" button, for **every** `kindFilter` value (it's a shortcut; it always creates a custom form). Markup per the mock: heading "Start from a template" + right-aligned note "Copies into a new draft you can rename and edit"; one card per `FORM_TEMPLATES` entry: icon tile "1·2·3", title + "Wizard" pill, blurb, step chips (numbered, `→` between, final ✓ "Check and send" chip when `settings.review`), buttons **Use this template** (primary) and **Preview** (outline). Use the existing `Card`/`Button`/`Badge` components and Tailwind classes, styled to match the mock (white card, 4 px blue left border). Stack the buttons under the text below `sm`.
   - **Use this template** → `setKindFilter('custom')`, `setEditor(draftFromTemplate(t, { branchSlugs }))`, `setEditorOpen(true)`.
   - **Preview** → `setPreviewForm({ ...draftFromTemplate(t, { branchSlugs }), name: t.name })`.
5. **New button:** for `custom`, show **＋ New custom form** (opens `draftFromTemplate` of an empty custom form: name "Untitled form", one step "Step 1", no fields, `layout: 'page'`). For `detailing`, keep **＋ New detailing form**.
6. **Card description text** under the title: for custom, "Custom forms: start from a template or from scratch. Published public slugs stay locked so printed QR codes keep working."
7. **Archive:** allow for `isCreatableFormKind(selectedTemplate.kind)` (detailing + custom), not only detailing.
8. **saveForm:** replace the `if (!isDetailingFormKind(editor.kind))` insert guard with `if (!isCreatableFormKind(editor.kind))`, message "Only detailing and custom forms can be created here". Success toast: "Form created". After insert, select the new form (`setSelectedFormId(inserted.data.id)`) and keep `kindFilter` on its kind. Before saving a wizard, drop any field `step` that no longer matches a step id (put it on the first step) and refuse to save a wizard with no steps (toast "Add at least one step or switch Show as steps off").
9. **Editor dialog** (only additions; keep every existing control):
   - Title: `{editor.id ? 'Edit' : 'Create'} · {formKindSingular(editor.kind)}`; Kind box shows `formKindSingular`.
   - Event attach stays hidden for detailing **and** custom (`!isCreatableFormKind(editor.kind)`).
   - After Description, a bordered block with a **Show as steps** switch (there is no `switch` in `src/components/ui/` — use a checkbox input with `role="switch"` and `aria-checked`, styled as the toggle in the mock; don't add a new dependency), label + one-line explanation from the mock. Toggling on with no steps creates `[{ id: 'step_1', title: 'Step 1', hint: '' }]` and sets `review: true`; toggling off keeps the steps in settings but sets `layout: 'page'` (so toggling back restores them).
   - When on: **Steps** list — each row: number dot, Title input, Hint input (placeholder "Short hint (optional)"), ↑ ↓ ✕ icon buttons (`aria-label`s "Move step up", "Move step down", "Remove step"); removing a step moves its fields to the previous step (or the next if it was first) and asks `window.confirm` only if that step had fields. **＋ Add step** appends `{ id: 'step_<n>' unique, title: 'Step <n>', hint: '' }`. Checkbox **End with a "Check and send" screen** ↔ `settings.review`.
   - **Thank-you message** input (always shown, wizard or not) ↔ `settings.thank_you.body`; placeholder = the default body text.
   - **FieldBuilder:** add props `steps` (array or null). When `steps` is set: show a **Step** select on each field row (between Type and Required; blue outline as in the mock), and render fields grouped under small headings "Step 1 · About you" etc. in step order (the array order inside `editor.fields` should follow the grouping — reorder on save with a stable sort by step index). Up/Down move within the group. "＋ Add field" adds to the last step. When `steps` is null, FieldBuilder looks exactly as today.
10. **Staff "Fill a form" card:** unchanged (single page, even for wizard forms). Add `custom` to `fillableForms` via the permission change in 4.7. Planner card label for custom: `[{ name: 'Custom', color: '#94a3b8' }]` (neutral slate-400, the "grey Planner label") in the `labels:` ternary chain.

### 4.7 `src/auth/permissions.js`

`canSubmitOpsFormKind`: treat `custom` like `detailing` → `canViewPlanning(profile)`. Update the doc comment above the function.

### 4.8 Anything else that switches on kind

Search before you finish: `grep -rn "'detailing'" src server api` and `grep -rn "isDetailingFormKind" src`. Today the only kind switches are in `opsForms.js`, `permissions.js`, `PlanningFormsSmartPanel.jsx` and `server/notifyOpsEvent.mjs` (cash_advance only — leave it). If you find another, give custom the same handling as detailing unless it's detailing-specific business logic (e.g. bookings/catalogue), and list it in your report.

---

## 5. Tests

Unit tests use `node:test` (`npm test` runs `scripts/run-unit-tests.mjs`). Add/update:

1. **`tests/opsForms.test.js`** (existing):
   - `FORM_KINDS.length` is now **6** and includes `custom`; `isFixedFormKind('custom') === false`; `isCreatableFormKind` true for detailing + custom only.
   - `normalizeFields` keeps `step`, drops empty `step`, still drops unknown keys.
   - `normalizeFormSettings`: `layout` defaults to `'page'`; wizard steps get ids/titles; `review` defaults true for wizard; existing keys unchanged for an old settings object (snapshot the detailing-inquiry settings from `20260908025944_detailing_ops_forms_qr.sql`).
   - `WIZARD_FORM_TEMPLATE`: kind `custom`, every field's `step` is a real step id, required keys `customer_name`, `phone`, `branch` present.
   - `draftFromTemplate`: status `draft`, id null, slug empty, branch options filled from `branchSlugs`, and mutating the draft does not change the template (deep copy).
   - `submissionTitle({ kind: 'custom', name: 'Quote request' }, { customer_name: 'Ana' })` → `'Quote request: Ana'`.
2. **`tests/formWizard.test.js`** (new): grouping (missing/unknown step → first step), `wizardScreens` with and without review, `validateStep` only reports that step's fields, `firstInvalidStep`, `answerRows` (skips empty, checkbox → Yes, date formatting), and a non-wizard form → `isWizardForm` false.
3. **`tests/ownerRevisionsPhase6.test.js`** or a new small test: `canSubmitOpsFormKind` for `custom` matches `detailing` for a planning viewer and is false with no role.
4. **Migration test** (new, e.g. `tests/opsFormsCustomKindMigration.test.js`): read the new migration file and assert it contains `drop constraint if exists ops_forms_kind_check`, a check list with all six kinds, `create or replace function public.can_submit_ops_form` with a `when 'custom'` branch whose role list equals the `'detailing'` one, every `when '<kind>'` branch from the previous definition still present, and `begin;` / `commit;`. (It widens a constraint, so it is **not** added to `GUARDED` in `tests/guardedMigrationContract.test.js` — leave that file alone; it also has someone else's uncommitted changes.)
5. **Source/markup guard** (pattern used across this repo, e.g. `tests/planningUi.test.js`): read `PlanningFormsSmartPanel.jsx` and assert it contains `Start from a template`, `Use this template`, `Show as steps`, `New custom form`; read `BrandedOpsForm.jsx` and assert `role="progressbar"` and `Check and send`.

Run, from the repo root:

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

All three must pass. Unit count was 2226/2226 on 17 Oct; others may have added tests since — report the number you get, and if something fails that you didn't touch, check it fails the same way without your changes (`git stash` is **not** allowed; compare against a clean `git worktree add` of `HEAD` in your scratch folder instead) and report it as pre-existing.

Browser tests (`npm run test:browser`) need the production build served on port 4173 first (preview config "preview" in `.claude/launch.json`, `http://127.0.0.1:4173`); without it they fail with `ERR_CONNECTION_REFUSED`. Run them once at the end and report the result; you are not required to add a browser test, but if you do, put it in a new `tests/wizardForm.browser.test.js` and don't edit the existing browser test files.

---

## 6. Verify on localhost only

1. Start the dev server with preview config **"dev"** → `http://localhost:5180` (never `npm run dev` via a shell).
2. **Important:** localhost has **no Supabase env** — the ops sign-in page shows "Supabase is not configured", and the demo logins don't work there. So:
   - Public wizard: check the renderer with a fixture, not the live DB. Simplest: a temporary dev-only harness, e.g. a scratch page in your session scratchpad served by a tiny Vite/Node server that renders `BrandedOpsForm` with `WIZARD_FORM_TEMPLATE` (an earlier session did this with a mocked Supabase + auth in a scratchpad `qa/server.mjs`, launch config "ops-qa" on port 5230 — that file may no longer exist; recreate in **your** scratchpad if needed). Do not add the harness to `src/` or commit it.
   - Forms tab: same approach — mock `supabase.from('ops_forms'|'ops_form_submissions'|'events')` and `listBranches`, sign in as a fake super-admin profile, and open `/operations/planning` → Forms.
   - Never point localhost at the live project and never write to live tables.
3. Check, at **1280 px** and **375 px** wide (use `resize_window` presets desktop and mobile), against the mock:
   - Forms tab: template row under the picker; Use this template opens the Create dialog as "Create · Custom form", Draft, three steps, nine fields grouped by step; Preview walks every screen; "Which form" has Custom forms; New custom form works; the Detailing services view is unchanged.
   - Public wizard: Step 1 has no Back; Continue with an empty required field shows the error under that field and focuses it; Back keeps answers; review lists answers per step and Edit jumps back; the Terms tick is on the review screen; Send reaches the thank-you with the editor's text and a reference; a non-wizard form (detailing inquiry fixture) looks exactly as before.
   - No horizontal scroll at 320 px; tap targets ≥ 44 px; keyboard only (Tab / Enter / Shift+Tab) can finish the form; reduced motion respected.
4. Save screenshots to `e2e-evidence/wizard-form-template/` (desktop + phone for: Forms tab, editor, step 1, a validation error, review, thank-you). Show them to Kirk.

---

## 7. Done means

- [ ] Migration file added (section 2) — **not applied**; the SQL is in your report for Kirk.
- [ ] Sections 4.1–4.7 implemented; existing forms (complaint, events RSVP, equipment, cash advance, detailing inquiry) look and behave exactly as before.
- [ ] Tests from section 5 added; `npm test`, `npm run lint`, `npm run build` pass (numbers reported); browser tests run with the build served on 4173, result reported.
- [ ] Verified on localhost with fixtures at 1280 and 375 px; screenshots in `e2e-evidence/wizard-form-template/`.
- [ ] `CHANGES.log` appended; `graphify update .` run (project rule after code changes).
- [ ] Nothing committed, nothing pushed; others' uncommitted files untouched (compare `git status` with the list you wrote down in step 0).
- [ ] Report to Kirk: what changed (file list), the SQL to run, what you could not verify (live save of a custom form needs the SQL first), and screenshots.

After Kirk runs the SQL and says go, the commit should contain only: the migration, `src/lib/opsForms.js`, `src/lib/formWizard.js`, `src/components/BrandedOpsForm.jsx` (and `BrandedOpsWizard.jsx` if split), `src/pages/PublicFormPage.jsx`, `src/pages/planning/PlanningFormsSmartPanel.jsx`, `src/auth/permissions.js`, the `src/styles.css` hunk for `.wz-*`, the new/updated tests, `docs/forms/`, and the mock folder `design-mocks/wizard-form-template-2026-10-17/` if Kirk wants it tracked. Stage by path (and by hunk for `src/styles.css` if others have changes there).
