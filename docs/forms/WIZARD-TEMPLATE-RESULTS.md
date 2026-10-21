# Wizard template implementation — 18 October 2026

Option B implemented. Kirk authorized committing and pushing the wizard changes to GitHub on 18 October 2026. Kirk confirmed on 18 October 2026 that he ran the migration SQL. This is user-confirmed, not independently verified. Codex did not apply SQL or write live tables. Publication is tracked in the task’s final response and local CHANGES.log.

## Changed files

- `src/lib/opsForms.js`: custom kind, template/draft helpers, optional field step, normalized wizard settings.
- `src/lib/formWizard.js`: grouping, screen sequence, validation, review formatting.
- `src/components/BrandedOpsForm.jsx`: shared field renderer; wizard navigation, errors, review, preview, success/reference; single-page path preserved.
- `src/pages/PublicFormPage.jsx`: retain submission reference and reset route-specific state.
- `src/pages/planning/PlanningFormsSmartPanel.jsx`: template row, custom creation/list/archive, step editing/grouping, thank-you settings, custom Planner label/title. New rows enter the local cache before selection; raw option text remains editable.
- `src/auth/permissions.js`: custom matches detailing for staff.
- `src/styles.css`: scoped wizard styles and custom Planner label token (approved grey #94a3b8).
- `supabase/migrations/20261018150000_ops_forms_custom_kind.sql`: kind constraint + staff helper; Kirk confirmed manual application on 18 October 2026.
- `tests/opsForms.test.js`, `tests/commandCategories.test.js`: expect six kinds including custom.
- `tests/guardedMigrationContract.test.js`: narrow exemption for the widening migration, with existing referral changes preserved.
- `tests/formWizard.test.js`, `tests/opsFormsCustomKindMigration.test.js`: new behavior, permission parity, migration and markup coverage.
- `e2e-evidence/wizard-form-template/`: local fixture screenshots.

## Verification

- Focused wizard/category/token/migration checks: **72/72 pass**.
- `npm test`: **2296/2299 pass**. Three failures are `roleGuideParity` for Detailer, Sales and Marketing missing “Detailing Board”; all three reproduce in an untouched checkout of HEAD c19ecb1. These were left unchanged.
- `npm run lint`: **pass**, exit 0.
- `npm run build`: **pass**, including PWA generation. The built Planner chunk was checked to contain the new-row cache/selection fix.
- Browser suite with `PUBLIC_TEST_URL=http://127.0.0.1:4173` and `--test-concurrency=1`: **35/39 pass**. Failures: wash-review carousel wrap at desktop width, and tint-comparison console 500 errors at 1440/393/320px. The same four checks pass against a clean HEAD build with a loopback-only fake Supabase configuration. This comparison uses a different backend environment, so it does not prove identical pre-existing failures; the production-preview browser suite remains non-green.
- Wizard fixture QA: **pass** at 1280/375px (all six screenshot states), 320px no overflow and 44px public action targets, reduced-motion rendering, per-step errors/focus and clearing, Back persistence, review/Edit/Terms, successful submission/reference, review disabled, unchanged detailing single-page fixture, no runtime errors.
- Editor fixture QA: **pass** for template draft, custom from scratch, preview navigation, steps toggle/restore/add/remove/reassignment, editable option delimiters, newly saved selection, constraint error with no detailing fallback, and staff single-page fill producing `Step-by-step form: Ana` with the exact grey Custom label.
- Keyboard-only full template completion: **pass** at 320px with reduced motion using Tab, Shift+Tab, Enter and native-select typeahead. Headless macOS ArrowDown dropdown selection failed even in plain HTML; typeahead works and completed the actual form.
- `git diff --check`: **pass** for this task’s files.

The migration listing test now explicitly exempts this widening migration. Kirk’s “continue” followed the prepared-patch permission question; only that narrow exemption was applied, preserving the existing referral entry.
Fresh review found two issues (new-form selection race and delimiter stripping in select options). Both corrected; the browser regression now passes with delayed mock loads.

Fixtures run at `http://127.0.0.1:5230/__wizard-qa` (public) and `?panel` (Forms tab), entirely in scratch space. Supabase, auth and branches are replaced by in-memory modules. The dev server already running on 5180 is left alone. No Browser plugin or launch tool is available; existing Puppeteer infrastructure and a Vite API fixture server were used. No fixture files are added to app source.

The clean HEAD app cannot render a production build with no Vite Supabase variables at all (it throws “Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY”), so its comparison build used only `http://127.0.0.1:5341` and a fake anon key. No live project was supplied.

`graphify update .` was attempted; `graphify` is not installed/on PATH in this session.

## GitHub publication check

The staged wizard-only snapshot was checked in a detached temporary worktree, excluding all referral/birthday/PPF work. Its full unit suite passed 2235/2239: the same three baseline role-guide failures, plus the pre-existing recovery test that assumes `.git` is a directory (linked worktrees use a `.git` file). Wizard tests passed. Lint passed. The isolated production build passed using loopback-only fake Supabase settings. The referral migration’s GUARDED entry remains unstaged in the shared checkout; only the wizard exemption is included in this commit.

## Screenshot index

Desktop (1280px) and phone (375px):

- `forms-tab-desktop.png`, `forms-tab-phone.png`
- `editor-desktop.png`, `editor-phone.png`
- `step-1-desktop.png`, `step-1-phone.png`
- `validation-desktop.png`, `validation-phone.png`
- `review-desktop.png`, `review-phone.png`
- `thank-you-desktop.png`, `thank-you-phone.png`

## SQL manually applied by Kirk (user-confirmed)

Kirk confirmed this migration was run on 18 October 2026. The database prerequisite is recorded as completed based on that confirmation. Live custom-form saving and staff RLS remain unverified; the application changes were approved for GitHub publication at Kirk’s request. The UI displays database errors and never changes the kind to detailing.

```sql
-- Option B (wizard form template, approved 17 Oct 2026):
-- allow a 'custom' kind so admins can create general-purpose forms in Planner → Forms.
-- Widens the kind constraint and mirrors staff permissions; no rows change. Kirk applies this by hand.

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

## Scope decisions

- Shared checkout and no branch switching or stashing follow the approved plan. Kirk subsequently authorized committing and pushing the wizard changes.
- Grey labels use a CSS token resolved to the approved hex value when creating the Planner card; this meets the existing token consistency test.
- The additional commandCategories test had a second hardcoded five-kind assertion and was clean at task start; it was updated with the feature.
- Other detailing switches found in booking, POS, compensation, queue and customer visit code describe services, not ops form kinds, and were left alone. No additional ops-form switch required changing.
- Existing changed files were left alone by this implementation. A checksum comparison detected concurrent changes to `server/referral.mjs` from another session; this task never edited it.
