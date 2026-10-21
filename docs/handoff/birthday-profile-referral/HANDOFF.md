# Handoff — Birthday greeting · Profile progress · Refer a friend

Written 2026-10-17 for the next agent. **Design approved by Kirk on 2026-10-17.**

> **Status 2026-10-18: built by Claude in the original session, uncommitted** — see CHANGES.log 2026-10-18. Migration `20261018120000_refer_a_friend.sql` written and tested on local Postgres stubs, **not applied**. Open: should a referral reward be allowed on a queue/board ticket (it would change the crew-pay base)? Until decided, POS only applies it to catalog lines.

- **Approved mock: [`mock.html`](mock.html) in this folder. Open it first.** It is self-contained (fonts and images inlined), so it opens straight from Finder or a browser with no server. The guide below explains every screen in it.
- Mock source: `design-mocks/birthday-profile-referral-2026-10-17/src/index.html`. If the mock changes, rebuild it with `python3 design-mocks/birthday-profile-referral-2026-10-17/src/build.py`, then copy the built `index.html` over `mock.html` here so the two never drift.
- Earlier short plan: `design-mocks/birthday-profile-referral-2026-10-17/PLAN.md`. Where the two differ, **this file wins.**

## ⚠️ Decisions are PROVISIONAL — client feedback due 2026-10-18

Kirk gave the answers below on 2026-10-17 and expects the client to change some of them on 2026-10-18. **Build so that every one of them is a one-place change**: a settings row, a per-service flag or a single exported constant. Never scatter literals across components, SQL or tests. Section "Where each decision lives" says exactly where.

| # | Decision (Kirk, 17 Oct) | Value now | Lives in |
|---|---|---|---|
| D1 | Referral reward validity | **3 days** from when the reward unlocks | `referral_program_settings.validity_days` (default 3) |
| D2 | Which services count for referrals | Everything **except** Carwash, Express Wash Package and Engine Wash. Glass Detailing, Full Care Package and Hakum Custom Package **count**, as do tint, PPF, ceramic, paint maintenance and all detailing | `services.referral_eligible` per service (+ backfill) |
| D3 | Birthday gift wording | **"free carwash"** everywhere | `BIRTHDAY_GIFT_LABEL` in `src/lib/birthdayPerk.js` |
| D4 | Refunds / voids | The transaction must go through. A refunded or voided sale never counts: the referral goes back to **pending** and unclaimed rewards are voided | the triggers in the referral migration |
| D5 | `/refer` launch + nav placement | **Not decided.** See "D5 options" below | `referral_program_settings.enabled` + one footer/nav entry |
| — | Reward amount and yearly cap | **Still open.** Placeholder settings: `reward_label` "Detailing reward", cap 5 | `referral_program_settings` |
| — | Birthday perk length | Unchanged: 30 days (what the system already does). Rewards copy that says "birthday month" must say 30 days | `birthdayPerkExpiresAt()` in `src/lib/birthdayPerk.js` |

### Where each decision lives (so tomorrow's change is small)
- **Referral numbers and wording** (validity, reward, cap, on/off): one row in `referral_program_settings`, read by the server, the portal payload, the POS and the `/refer` page. **No referral number may be hard-coded in JSX or SQL functions.** SQL reads the row; the UI reads it from `/api/customer-portal` (app) or a small public `GET /api/customer?action=referral-settings` (public page).
  - Changing it tomorrow = Super Admin edits the settings form, or one `update` statement. No deploy.
- **Which services count:** `services.referral_eligible`. Changing it = flip the switch in `ServicesManagePage`. The JS `isReferralEligibleService` is only a fallback/test mirror and must read the flag when the row has it.
- **Birthday wording:** export `BIRTHDAY_GIFT_LABEL = 'free carwash'` (and the title-case form) from `src/lib/birthdayPerk.js`. Sign-up, Home, Me, Rewards, the greeting sheet and the pass all import it. The push/SMS text comes from the SA-editable `birthday.greeting` template, so update its **default** in `src/lib/notificationTemplates.js` too, and give Kirk a one-line SQL to update the live template row if he wants it.
  - Changing it tomorrow = one constant + one template edit.
- **Refund rule:** isolated in `public.unqualify_referral_for_sale(p_sale_id)` called from the `sales` status trigger. If the client wants "void forever" instead of "back to pending", only that function changes.
- **`/refer` visibility:** gated on `referral_program_settings.enabled` and one nav/footer config entry. See D5.

### D5 options — when `/refer` goes live, and where it is linked
Two separate choices.

**When:**
- **(a) Together with the program (03B) — recommended.** Page, links, POS and rewards all go live the same day. There is never a page promising a reward the counter can't give.
- **(b) Page first, "coming soon".** Gives early buzz, but customers will ask at the counter for rewards staff can't apply yet, and the page has to be rewritten once the reward is set.
- **(c) Page built early but hidden:** not linked anywhere, `noindex`, reachable only by URL on the Vercel test link. This is how the client reviews the real page before launch. **Use this until 03B is live, then switch to (a).** Concretely: build 03A behind `enabled`, and when it is false render the page only on non-production hosts (or with `?preview=1`) and keep it out of `sitemap.xml`.

**Where it is linked:**
- **Footer only:** low-key, always reachable, no crowding.
- **Top nav:** the strongest signal. But the nav already has Services, Live queue, Branches and Blog, so a 5th item tightens the phone menu and the 1024px layout. Needs its own small mock.
- **App Rewards tab:** always, whatever is chosen for the website. It is where existing customers actually get their link.
- **Recommendation:** footer + app at launch. Add the top nav only if the client wants a promotion push; it can be added or removed later as one entry.

---

## The mock, screen by screen (`mock.html`)

The pills at the top switch boards: **All · 01 Birthday greeting · 02 Profile progress · 03 Refer a friend · Plan**.
- Each board shows **NOW** (grey tag, today's app) beside **AFTER** (blue tag, what to build) on the same row.
- The notes under each screen are part of the spec.
- Phone frames are drawn at 340px wide. Build for real widths: 320–430px on phone, and the editorial layout from 860px.

**Look and feel to match.** These are the existing customer-app tokens in `src/styles/customer-native.css` and the BreDESIGN public styles. Reuse them; don't add new colours.
- **Colours:** navy ground `#020A31`, panels `#08133F` / `#0D1B52`, hairlines `#16255C`, paper ink `#F1F1ED`, sky accent `#9DB4FF`, button blue `#052699` with white text, amber `#F2B84B` for countdown warnings.
- **Type:** titles are uppercase italic Benzin 800. Eyebrows are Gilmer 800, uppercase and tracked, after a short rule. Buttons are uppercase tracked pills.
- **Shapes:** cards are near-square (6px radius) with a 1px outline.
- **Dock:** the floating dock with Home · Queue · Book · Rewards · Me already exists. Don't rebuild it.
- **Imagery:** the hero image is `bredesign-hero-poster.webp`.

### Board 01 — Birthday greeting
| Screen in the mock | Tag | What it shows / what to build |
|---|---|---|
| Home on their birthday | NOW | Today's small "Birthday treat" note below the queue and garage. This is what gets replaced. |
| First open on the day | AFTER | Bottom sheet over a dimmed Home. It has falling confetti, the Hakum mark, "Happy birthday, {first name}!", a dashed **gift ticket** ("Your birthday gift · One free carwash · any branch · valid until {expires_at}") and two buttons: **View live queue** (filled) and **Later** (outline). Shown once per perk year. Drop the "BDAY 2026" chip on the ticket (no code needed, see 01 step 3). |
| Home for the rest of the day (left phone) | AFTER | A gradient birthday hero card at the **top** of Home, above the live queue: "It's your day.", copy with the valid-until date, and a paper-coloured **Show my pass** button that goes to Rewards. Subtitle under the large title becomes "Happy birthday, {name} 🎉". |
| Days 2–30 (right phone) | AFTER | A slim row at the top of Home: gift icon, "Birthday carwash waiting", "Free at any branch · show the pass", and an **"N days left"** pill (amber in the last 7 days). |
| The pass (Rewards tab) | AFTER | A paper-coloured pass with a soft pink fade, **above** the stamp card: Hakum mark, "Birthday" tag, "Free carwash", name · plate, "valid until". **Build it without the dashed code box** ("BDAY-7K2Q") and without the "Staff: claim at POS" line. POS claims by customer. |

### Board 02 — Profile progress
| Screen in the mock | Tag | What it shows / what to build |
|---|---|---|
| Me → My profile | NOW | Separate email / phone / birthday forms with no sign of what is missing. |
| Home (left phone) | AFTER | "Your profile · Almost there." card with a big **60%**, a sky gradient bar, "Next: add your birthday — free carwash on your day." and one filled button for that next step. It sits above the live queue, replaces the "Add your birthday" row, and is hidden at 100%. |
| Me (right phone) | AFTER | Card at the top of Me: a **ring** with the percent, "3 of 5 done", one line of reason, then a **checklist**. Done rows have a green tick and grey text. Undone rows have an empty circle, a one-line reason and a sky **"Add ›"** link to that form's anchor. "My profile" stays as a row below. |
| What counts (table) | PROPOSED | The 5 equal steps. Same as the table in part 02 below. The optional "notifications on" step and the 100% reward are **out of scope**. |

### Board 03 — Refer a friend
| Screen in the mock | Tag | What it shows / what to build |
|---|---|---|
| No referral page or program | NOW | Placeholder: nothing exists today. |
| hakumautocare.com/refer — desktop | AFTER | Site nav with "Refer a friend". Two-column hero: eyebrow, the large italic title "Bring a friend. **You both** get pampered." (sky on "You both"), lede, **Get my link** (paper) + **How it works** (outline). On the right is the hero photo with a paper **"What you both get"** box (You / Your friend / Counts on / Use within 3 days / Limit). Below the hero: **three numbered steps**; a two-column FAQ (including "Does a carwash count?") beside the fine print; a blue **"Pamper it. Share it."** band; the footer. Numbers come from settings, never from JSX (see D1 and the settings rules). The amber "TBC" chips mark values still open. **Never ship a TBC chip**; fill the value or hide the line. |
| Phone: /refer (left phone) | AFTER | The same page stacked: photo on top fading into navy, title, lede, full-width **Get my link**, then the steps as cards. |
| Phone: Rewards card (right phone) | AFTER | "Refer a friend" card at the top of Rewards: a dashed **code box** ("KIRK-7Q2 · Copy link"), three share tiles (Messenger · Viber · More), "2 of 5 friends joined this year" and a 5-step **ladder**. Below it, one row per friend with a status line: signed up / "had a carwash — doesn't count" / got detailing → reward ready, use within 3 days. Friends appear by **first name only**. |
| What the friend sees | AFTER | The existing sign-up wizard with a gradient **"Invited by {first name}"** banner on top ("A detailing reward is waiting… Carwash doesn't count.") and "Referral code KIRK-7Q2 applied" under the button. The wizard steps themselves don't change. |

### Board Plan
This is the earlier summary of the plan. **This HANDOFF.md replaces it.** Where they differ, follow this file and its decisions table.

---

## 0. Ground rules for this repo (read before touching anything)

1. **Branch:** work on `main`, one commit per part (01, 02, 03A, 03B…). Don't push until Kirk says so.
2. **Other people's WIP.** Leave these alone. They are uncommitted and belong to someone else:
   - `src/components/public/home/PpfPackagesSection.{css,jsx}`
   - the PPF hunks in `tests/bredesignPublicPages.browser.test.js` and `tests/publicBranding.test.js`
   - the untracked images under `src/assets/`
   - everything under `design-mocks/`

   Stage only your own hunks.
3. **`CHANGES.log`.** Read the tail before you start. Append one dated entry per turn: what changed, the test results, and what is uncommitted. This is a multi-agent repo.
4. **graphify.** For codebase questions, run `graphify query "<question>"` first. After code changes, run `graphify update .` (see `CLAUDE.md`).
5. **Checks before every commit:** `npm test` (unit), `npm run lint`, `npm run build`.
   - Browser tests: `npm run test:browser`. They need `dist` served on port 4173 (`npx vite preview --port 4173`), otherwise they fail with ERR_CONNECTION_REFUSED.
   - About 7 browser tests have been flaky or pre-existing failures before. Compare against a clean `main` before you blame your change.
6. **There is no Supabase locally.** Signed-in screens can only be checked:
   - on the Vercel test link (demo logins are allowed there), or
   - with a fixture rig that fakes `sb-<ref>-auth-token` and intercepts supabase REST and `/api/*`.

   Never write to the live database to test.
7. **Database migrations:**
   - Write them under `supabase/migrations/` with a timestamp name after the latest one.
   - **Do NOT apply them to the live project** (`lybxhpzzqqyqswvuwpxv`) yourself.
   - Hand Kirk the SQL and wait for his explicit OK.
8. **Rules that already apply to these features:**
   - **Washes are walk-in.** Wash and detailing CTAs say **View live queue**, never Book. Only PPF, Ceramic and Tint are bookable.
   - **Imagery:** use real Hakum photos only. For app and hero surfaces, use `src/assets/hero/bredesign-hero-poster.webp`. Never use posters with burnt-in "BOOK NOW" text.
   - **SMS policy:** BusyBee sends outbound customer status/reminder SMS only. There are no inbound replies and no owner SMS.
   - Every *new* visual change still needs a mock and approval. The screens in the approved mock are covered.

---

## 01 · Birthday greeting on the day — FRONTEND ONLY

### What already exists (don't rebuild it)
- **Data:** `customers.date_of_birth` and `customer_birthday_perks` (one row per customer per year; `status` is available, claimed or expired; it expires after 30 days).
- **Server:** `server/birthdayGreetings.mjs` grants the perk and sends push + SMS from the `birthday.greeting` template. `server/customerPortal.mjs` also calls `grantBirthdayIfDue` and returns `data.birthday = { date_of_birth, perk }`.
- **Helpers:** `src/lib/birthdayPerk.js` has `isBirthdayToday`, `isBirthdayPerkActive` and `parseDateOnly`. They are Manila-time aware and handle Feb 29.
- **POS:** POS can already claim the perk. It uses the `is_birthday_award` cart line and the `claim_birthday_perk` RPC.

### Build
1. **`src/components/customer/BirthdayGreetingSheet.jsx`.** Use the existing `Sheet.jsx`.
   - Open it when `isBirthdayToday(dob)` and the perk is active.
   - Show it **once per perk year**. Store the localStorage key `hakum-bday-greeted-<customerId>-<perk_year>`, and wrap every read and write in try/catch.
   - Content: the Hakum mark, "Happy birthday, {first name}!", a gift ticket with the real `expires_at`, the **View live queue** button and a **Later** button.
   - Confetti is CSS only and lasts a few seconds. It stays static under `prefers-reduced-motion`.
2. **`BirthdayCard` on Home** (`src/pages/CustomerAccountPage.jsx`). It replaces the current `capp-note` block around line 545.
   - On the birthday: a hero card **above** the live queue, with a "Show my pass" button that goes to Rewards.
   - On days 2–30: a slim row with an "N days left" pill. The pill turns amber in the last 7 days.
   - Hide it once the perk is claimed or expired. Keep the existing "Add your birthday" row only until part 02 replaces it.
3. **Birthday pass on Rewards** (`src/pages/CustomerLoyaltyPage.jsx`). While the perk is active, show it above the stamp pass: name, plate and the valid-until date.
   - **No code on the pass.** POS claims by customer, so a code adds nothing.
4. **Desktop /account:** put the same card in the editorial column. Phone styles go in `src/styles/customer-native.css`. Use only `capp-` selectors and never touch ops styles.
5. **Wording (D3): "free carwash", valid 30 days.** The app currently mixes "free carwash", "free service" and "birthday month". Make sign-up, Home, Me, Rewards, the greeting sheet, the pass and the `notificationTemplates.js` default all import `BIRTHDAY_GIFT_LABEL` from `src/lib/birthdayPerk.js`. Rewards' "birthday month" becomes "30 days from your birthday".

### Tests
- Unit tests for a pure helper like `birthdayCardState(dob, perk, now)` returning greeting, countdown or none. Cover: on the day, day 2, day 24 (amber), claimed, expired, no DOB, and a Feb 29 birthday on Feb 28 of a non-leap year.
- Browser test at 375 and 1440 with fixture data. Check that the sheet opens once and stays closed after a reload.

---

## 02 · Profile completion progress — FRONTEND ONLY

### Build
1. **`src/lib/profileCompletion.js`.** Pure function: `profileCompletion(profile, vehicles) → { steps, done, total, percent, next }`. Five equal steps of 20% each:

   | Step | Done when | Link |
   |---|---|---|
   | Name & phone | `full_name` and `phone` present (always true after sign-up) | — |
   | A car saved | `vehicles.length > 0` | `/account/more?tab=garage&add=1` |
   | Car make & model | every vehicle has `vehicle_make` and `vehicle_model` | `/account/more?tab=garage` |
   | Birthday | `date_of_birth` set | `/account/more?tab=account#birthday` |
   | Real email | email set and `!isSyntheticCustomerEmail(email)` | `/account/more?tab=account#email` |

   `next` is the first undone step in this order: birthday, real email, car saved, make & model.
2. **`ProfileProgressCard` on Home.** It shows the percent, the bar and one next step with a button. Hide it at 100%. It replaces the "Add your birthday" row.
3. **Me page** (`src/pages/CustomerMorePage.jsx`):
   - Add a ring and checklist at the top. Each undone row gets an "Add ›" link.
   - Add `id="email"`, `id="birthday"` and so on to the forms in `AccountSection` so the anchors scroll to them.
4. Desktop /account gets the same card.
5. **Not in scope:** a "notifications on" step and any reward at 100%. Kirk didn't ask for either.

### Tests
- Unit tests for every combination (0 to 5 steps done, a synthetic email, a car without a model).
- A browser check at 375 and 1440.

---

## 03 · Refer a friend — **detailing and up only, never carwash**

### The rule (Kirk, 2026-10-17)
> "refer a friend doesn't work on carwash, only on detailing and up services."

This means:
- **A referral qualifies** only when the referred friend's first **paid** sale includes a **detailing-or-higher service**.
- **Rewards can only be used** on detailing-or-higher services. They can never pay for a carwash.
- **The transaction must go through (D4).** Only a sale with `status = 'paid'` counts. If it is later voided or refunded, it stops counting.
- **Rewards last 3 days (D1)** from the moment they unlock. That is `validity_days` in the settings row, so it can change tomorrow without a deploy.
- A friend who only buys carwashes stays *pending*. A later detailing visit still qualifies them.

### Which services count
This is the live catalog as of 2026-10-17. It was a read-only query; inactive test/audit rows are excluded.

| Service (slug) | pay_category | Counts? |
|---|---|---|
| Carwash (`premium-car-wash`) | wash | **No** |
| Express Wash Package (`express-wash-package`) | package | **No** |
| Engine Wash (`engine-wash`) | addon | **No** |
| Glass Detailing (`glass-detailing`) | addon | **Yes** (D2) |
| Full Care Package (`full-care-package`) | package | **Yes** (D2) |
| Hakum Custom Package (`hakum-custom-package`) | package | **Yes** (D2) |
| Interior Detailing (`interior-detailing`) | general | Yes |
| Full Exterior Detailing (`full-exterior-detailing`) | general | Yes |
| Mobile Detailing (`mobile-detailing`, inactive) | general | Yes |
| Paint Maintenance | detailing | Yes |
| Ceramic Coating + Premium + Platinum | detailing | Yes |
| Nano Ceramic Tint | detailing | Yes |
| PPF + Basic / High Impact / Ultimate / Platinum | detailing | Yes |

⚠️ **Don't key off `pay_category` alone.** Interior and Full Exterior Detailing are `general`, the same as plain services.

**Use an explicit flag:** `services.referral_eligible boolean not null default false`. Backfill it with this rule:
- true when `pay_category = 'detailing'`, or
- `slug in ('interior-detailing','full-exterior-detailing','mobile-detailing','glass-detailing','full-care-package','hakum-custom-package')`, or
- `slug like 'ppf%'`.
- Everything else stays false. Today that is Carwash (`premium-car-wash`), Express Wash Package and Engine Wash, plus the inactive test rows.
- New services default to **false**, so a new wash never counts by accident. Super Admin turns it on.

Super Admin can then change it per service. Add a "Counts for refer a friend" switch in `src/pages/ServicesManagePage.jsx`. Mirror the default in JS as `isReferralEligibleService(service)` in `src/lib/referral.js`, for UI hints and tests only. **The database flag is the truth.**

### Phase 03A — public `/refer` page (frontend, can ship first)
1. Add the route `/refer` in `src/App.jsx`, next to the other public routes. Add page meta (`usePageMeta`; see `src/lib/pageMeta.js`) and an entry in `public/sitemap.xml`.
2. Copy the page content from the mock's Refer tab, built from the existing BreDESIGN public components and styles:
   - hero (eyebrow, "Bring a friend. You both get pampered.", the "What you both get" box with "Counts on: detailing & up — not carwash")
   - 3 steps
   - FAQ, including **"Does a carwash count?"** with the answer **No**
   - fine print listing the services that count and saying that carwash, wash packages and add-ons don't count
   - the "Pamper it. Share it." band
3. **Until Phase 03B is live and Kirk sets the reward**, the reward text reads "Detailing reward", and "Get my link" goes to sign-in or the app.
   - Until D5 is decided, follow **D5 option (c)**: hidden, unlinked, `noindex`, out of the sitemap, viewable on the Vercel test link for client review.
   - Every number and reward word on the page comes from the settings (`GET /api/customer?action=referral-settings`), never from the JSX. Until 03B exists, use one exported defaults object in `src/lib/referral.js` that matches the settings defaults.
   - Don't publish TBC placeholders.
4. Footer link in `src/components/public/SiteFooter.jsx`, rendered only when `enabled`. A top-nav entry only if D5 says so (it needs its own small mock).

### Phase 03B — the program (backend + app). **Migration needs Kirk's OK before it is applied.**

**Schema** (one migration; model the RLS on `customer_birthday_perks` in `20260811140000_birthday_notification_templates.sql`):
- `services.referral_eligible` plus the backfill above.
- `referral_program_settings`: a single row with:
  - `enabled` (default **false**)
  - `reward_label` (e.g. "₱500 off detailing")
  - `reward_kind` (`amount_off` | `percent_off`) and `reward_value`
  - `validity_days` (default **3**, D1)
  - `yearly_cap` (default 5)
  - `updated_at` and `updated_by`

  Staff can read it. Only Super Admin can write it.
- `customers.referral_code text unique`, generated lazily as `FIRSTNAME-XXX`: uppercase, 3 random characters without 0/O/1/I.
- `customer_referrals`:
  - `id`, `referrer_id`, `friend_id unique`, `code`
  - `status` (`pending` | `qualified` | `void`)
  - `qualifying_sale_id`, `qualified_at`, `voided_reason`, `created_at`
  - a check that `referrer_id <> friend_id`
- `customer_referral_rewards`:
  - `id`, `customer_id`, `referral_id`
  - `role` (`referrer` | `friend`)
  - `status` (`available` | `claimed` | `expired` | `void`)
  - `expires_at`, `claimed_at`, `claimed_sale_id`
  - unique (`referral_id`, `role`)
- **RLS:**
  - Customers read their own referrals (as referrer or friend) and their own rewards.
  - Active staff can read everything.
  - Nobody writes directly. Revoke insert, update and delete as the birthday perks migration does.

**Qualification (in the database, idempotent):**
- `public.qualify_referral_for_sale(p_sale_id uuid)`, security definer. A referral qualifies when **all** of these hold:
  - the sale has `status = 'paid'`, and `sales.customer_id` is a friend with a `pending` referral
  - the sale has ≥1 `sale_line_items` row whose `service_id` points at a `services.referral_eligible = true` row **and** has `line_total_minor > 0`. Free award lines are ₱0, so a free or birthday detailing doesn't count.
  - `sales.occurred_at` is after `customer_referrals.created_at`
  - the program is enabled and the referrer is under `yearly_cap` for this calendar year (Manila time)

  It then sets the referral to `qualified` and inserts two `available` rewards with `expires_at = now() + validity_days`.
- **Hook:** an `AFTER INSERT` trigger on `sale_line_items` that calls the function. Do **not** edit `complete_pos_sale`. It has been redefined 15 times; the latest is in `20261005140000_ba_pos_merch_only.sql`. Check that the line items are inserted inside the same transaction, after the `sales` row. If they aren't, trigger on `sales` instead.
- **Voids and refunds:** an `AFTER UPDATE OF status` trigger on `sales`. If the qualifying sale becomes `voided` or `refunded`:
  - set the referral back to `pending` (D4), clear `qualifying_sale_id`/`qualified_at`, so the friend's next paid detailing can still qualify
  - set its *unclaimed* rewards to `void`
  - if a reward was **already claimed** on another sale, leave that sale alone but write the case to the referral row (`voided_reason`) so staff can see it. Don't claw back money automatically.
  - keep this in its own function, `unqualify_referral_for_sale(p_sale_id)`, so the rule can change in one place

  Sale statuses seen live: `paid`, `voided`, `refunded`.
- **Expiry:** treat `expires_at < now()` as expired when reading. Optionally sweep it in the existing daily job (`/api/notifications` `birthday-greetings` runs daily).

**Sign-up linking:**
- **`/r/:code` route:**
  1. Store the code in sessionStorage (try/catch).
  2. Redirect to `/signup`.
  3. The sign-up wizard (`src/pages/CustomerSignUpPage.jsx`) shows the "Invited by {first name}" banner from the mock. **The wizard steps don't change.**
- **Public lookup:** `GET /api/customer?action=referral-lookup&code=…`. Add it to the `api/customer.js` handlers.
  - Rate-limit it with `server/httpUtil.mjs` `rateLimit`.
  - Return the **first name only**, or 404. Never return a phone, plate or full name.
- **`server/customerSignup.mjs` `signupCustomer`:** accept an optional `referral_code`. Create the `customer_referrals` row **only if** all of these hold:
  - the program is enabled and the code exists
  - it is a brand-new account, not a Team Lead CRM claim or a `must_set_password` claim (see `resolveClaimPath`)
  - the friend has **no prior paid sales** (walk-in history attached by `claimWalkInHistory` disqualifies them)
  - it is not self-referral (different customer, and a different phone than the referrer)

  A bad or ineligible code must **never block sign-up**. Ignore it silently.

**Using the reward at POS** (`src/pages/PosPage.jsx`, `src/lib/posSale.js`). Follow the birthday-award pattern:
- After choosing a customer, load their `available`, unexpired referral rewards (the same way `refreshBirthdayPerk` does).
- A reward can only be applied **to a `referral_eligible` line**. It is disabled on Carwash, wash packages and add-ons, with the hint "Refer-a-friend rewards are for detailing and up".
- Apply it as a discount on that line (amount or percent from the settings). Mark the line so the integrity checks accept it, and extend `validatePosSale` / `assert_pos_sale_integrity` carefully.
- After `complete_pos_sale`, call a new RPC `claim_referral_reward(p_customer_id, p_reward_id, p_sale_id)`, modelled on `claim_birthday_perk` in `20261009121000_tighten_pos_side_rpcs.sql`. It must **re-check on the server** that the sale contains an eligible paid line.

**Customer app:**
- `server/customerPortal.mjs` GET adds `referral`:
  - `{ enabled, code, link, reward_label, yearly_cap, used_this_year }`
  - `referrals[]`: friend **first name** only, status, and a `waiting_reason` (e.g. "only carwash so far")
  - `rewards[]`
- Rewards tab card (`CustomerLoyaltyPage.jsx`), as in the mock:
  - code box with copy link (`https://hakumautocare.com/r/CODE`)
  - share buttons: `navigator.share` first, then Messenger and Viber deep links, then copy
  - cap ladder
  - the friend list, including the "Leo had a carwash — doesn't count yet" state
- Home: no new card in v1. Rewards is enough.

**Notifications:**
- Web push to both sides when a referral qualifies. Use template key `referral.reward` in `src/lib/notificationTemplates.js`, seeded in the migration like `birthday.greeting`.
- An optional SMS to the referrer when the reward unlocks counts as customer status SMS, so it's allowed. Send it through the existing lifecycle SMS path. Never send owner SMS.

### Tests for 03
- **Unit:**
  - `isReferralEligibleService` over the table above
  - code generator (format, no ambiguous characters)
  - POS validation: a reward on Carwash is rejected; on Interior Detailing it is accepted; one reward per line
  - the portal payload shape
  - the sign-up guard cases: new phone ✓, TL claim ✗, prior sales ✗, self ✗, bad code doesn't block sign-up
  - **change-proofing:** tests take the settings and eligibility as input (validity 3 → `expires_at` = unlock + 3 days; set it to 30 and it follows). A test fails if a referral number or "free carwash" literal appears outside `src/lib/referral.js` / `src/lib/birthdayPerk.js` (a simple grep test over `src/`).
- **SQL tests** (follow the repo's existing pattern for RPC tests, or add a scripted check against a Supabase branch, **never live**):
  - a carwash-only sale leaves the referral pending
  - a mixed carwash + interior detailing sale qualifies
  - a ₱0 award detailing line doesn't qualify
  - the second qualifying sale doesn't double-grant
  - void and refund handling (back to pending, unclaimed rewards void, the next paid detailing re-qualifies)
  - the yearly cap
- **Browser:** `/refer` at 320, 375, 1440 with no horizontal overflow; the `/r/CODE` banner on sign-up; the Rewards card with fixture data.

---

## Order and done-when

| # | Part | Ships | Done when |
|---|---|---|---|
| 1 | 01 Birthday | frontend | sheet once a year, Home card + countdown, Rewards pass; unit + browser green |
| 2 | 02 Profile | frontend | Home card + Me checklist with working anchors; unit + browser green |
| 3 | 03A /refer page | frontend | page, meta, sitemap, footer link; hidden or unlinked until 03B is live (Kirk decides) |
| 4 | 03B schema | migration file only | SQL reviewed by Kirk; applied by Kirk / with his OK |
| 5 | 03B server | api + RPCs | sign-up linking, qualification trigger, claim RPC, portal payload; tests green |
| 6 | 03B app + POS | frontend | Rewards card, POS reward on detailing lines only; checked on the Vercel test link |

Before each commit, re-run the full checks (unit, lint, build, browser) and append to `CHANGES.log`.

## Still open (don't guess — check the decisions table first, it may have changed on 18 Oct)
1. Referral reward: what each side gets (amount or percent off a detailing-or-higher service) and the yearly cap.
2. D5: when `/refer` goes live, and footer, top nav or both.
3. 3-day validity (D1) is short for services that are booked ahead: Ceramic, Tint and PPF are multi-day and booking-only. Confirm with the client that 3 days is intended, or whether it should count from booking rather than from the visit.
