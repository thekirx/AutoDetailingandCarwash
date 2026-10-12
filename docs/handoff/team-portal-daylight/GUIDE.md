# Team Portal redesign — Option B "Daylight" (frontend only)

**Status:** client-approved 12 Oct 2026. **Scope:** presentation only.
**Approved mock (in this folder):** `approved-mock-option-b-daylight.html` — open it in a browser.
`overview-before-and-options.html` shows today's portal screens and why B was chosen. Both are
self-contained (fonts and images are embedded). The option tabs at the top of these pages link to
files that are not in this folder; ignore them.

This guide is self-contained: if the mock file is missing, sections 3–5 describe it fully.

---

## 1. The one rule: frontend only

You are restyling and re-arranging what the team portal (`/operations/*`) already shows. You are
**not** changing what it does.

Allowed:
- JSX structure, class names, layout, CSS, Tailwind classes, copy (labels, helper text, empty states).
- Re-ordering what is already on a screen, hiding filters behind a toggle, grouping a list.
- Formatting values already in memory (e.g. showing "12 min" instead of "1414h 43m").
- Ordering a list client-side from fields the page already loads (stage + time waiting).

Not allowed (stop and ask Kirk if a design idea needs one of these):
- Any change to Supabase queries, RPCs, `/api/*`, `server/`, migrations, RLS, edge functions.
- Any change to `src/auth/permissions.js` logic (who sees what). You may restyle how the nav it
  returns is rendered, and rename labels (see the glossary), but not add or remove items or roles.
- New actions that need the backend (e.g. "Remind team lead", "Send SMS"). Buttons must call the
  exact same handlers they call today.
- Route changes. Every URL keeps working, including deep links and `?tab=` params.
- Business rules. In particular **only the Team Lead can push a car from Final Check to payment;
  admins can only send a car back.** Do not surface a "pass" action to anyone else.
- SMS: BusyBee is outbound customer reminders/status only. No owner SMS, no inbound replies.

If a screen in the mock shows something the data cannot support today (for example a "My car"
view for crew that needs crew-assignment data crew cannot read), leave that part out and note it in
CHANGES.log. Do not add a query to make it work.

## 2. What "Daylight" is (the design in one paragraph)

The website's navy and Benzin stay where the website puts them — the **header, side menu and
bottom tab bar** — and the **working area turns light** (paper `#F1F1ED`, white cards) so plates,
times and buttons read clearly in sun at the wash bay. The queue is **one scroll grouped by stage**
(no stage tabs, no filter dropdowns above the cars) and **every card carries its own next button**.
The team lead's own jobs sit on top in a "Your move" group. Plain words everywhere.

## 3. Design tokens

Use the site's palette (from `src/styles/bredesign.css` / `src/design-tokens.css`). Add these as
CSS custom properties scoped to the ops shells (e.g. on `.floor-app-stage` and `.command-shell`);
do not change the public site's tokens.

| Token | Value | Use |
|---|---|---|
| `--navy` | `#020A31` | header bar, side rail, tab bar |
| `--rule` | `#16255C` | lines on navy |
| `--accent` | `#9DB4FF` | small caps labels on navy, active text on navy |
| `--blue` | `#052699` | primary buttons, active item, plate chips' text when on white |
| `--blue-hover` | `#0a32c2` | primary hover |
| `--paper` | `#F1F1ED` | page background (work area) |
| `--card` | `#FFFFFF`, border `#E1E1DA` | cards |
| `--ink` | `#0B1233` | main text on paper |
| `--ink-2` | `#41486B` | secondary text |
| `--ink-3` | `#5D6488` | meta text (still ≥ 4.5:1 on white) |
| `--ok` | `#1F9D63` | pass / done (always with an icon + word) |
| `--warn` | `#B7791F` / bg `#FBEFD9` | late, attention |
| `--bad` | `#C9353B` / bg `#FBE4E4` | redo, overdue |

Stage colours (dot/bar only, never colour alone — always with the stage word):
Waiting `#7E8AB8`, Washing `#5B8CFF`, Final check `#E0A93A`, Redo `#C9353B`, To pay `#8B6CF0`, Done `#1F9D63`.

Type (fonts already loaded by the app):
- **Display:** Benzin 800, UPPERCASE, `transform: skewX(-6deg)` — page titles only ("QUEUE",
  "TIME CLOCK", "TODAY"). One per screen.
- **Body/UI:** Gilmer 500 (body), 700 (card titles), 800 for UPPERCASE tracked labels and buttons.
- **Buttons:** pill (`border-radius: 999px`), Gilmer 800, 11px, `letter-spacing: .14em`,
  UPPERCASE, min-height 46px. Primary = blue fill; secondary = outlined.
- **Plates:** Benzin, white text on navy chip (`border-radius: 5px`), so a plate reads like a plate.
- Numbers that line up use `font-variant-numeric: tabular-nums`.

## 4. The shells (`src/layouts/OperationsLayout.jsx`)

There are two shells. Keep both, restyle both. Their nav data comes from `src/auth/permissions.js`
(`getTeamLeadDock`, `getStaffDock`, `getSalesDock`, … and `getOperationsNav` /
`groupOperationsNav`) — render it differently, do not change it.

### 4a. FloorAppShell (phone-first: team lead, crew, sales, marketing, video editor, detailer)
- **Header (navy):** Hakum mark (white) · two lines: "Rina · Team lead" (Gilmer 700, white) and
  branch in `--accent` caps ("BACOOR"). Right: notification bell with a red count badge, account
  button. Nothing in the header truncates; if space is tight, drop the name before the branch.
  44×44 hit areas.
- **Page title** sits in the navy header under that row, Benzin skewed caps.
- **Search** is a single white field in the header ("Find plate, phone or name"). Date/duration
  filters move behind a "Filter" control or into search results — not above the list.
- **Bottom tab bar (navy, fixed):** the dock items from permissions, icon + label always, active
  item = light pill (`rgba(157,180,255,.14)`) with white text. A "primary" dock item (e.g. New car)
  renders as a white pill button with navy icon + label. Respect `env(safe-area-inset-bottom)`.
- **Tablet+ (≥768px):** keep the existing left rail behaviour, styled navy with the same items.
- "More" opens the existing `ResponsiveSheet`; style its rows as white list rows with icons.

### 4b. CommandShell (desktop: super admin, assistant super admin, branch admin, investor)
- **Side rail (navy, ~232px):** Hakum wordmark lockup (white), groups with small caps labels in
  `#6E79A8`, items Gilmer 600 14px, active item = white pill with blue text. Footer: name + role ·
  scope, Account, Sign out.
- **Group labels in plain words:** Today · Counter · Customers · Business, with rarely used tools
  under "More tools" (only rename the group labels/headers the shell renders; keep items and order
  rules from `groupOperationsNav` — if a rename needs a permissions change, don't).
- **Top bar (light):** page title (Benzin, skewed) left; right: branch scope chip, Search (⌘K —
  existing `CommandMenu`), notifications. All chips white with `#D3D3CB` border, pill shape.
- Work area background `--paper`, max-width as today.

## 5. Screens (do these first, in this order)

### 5a. Team lead queue — `OperationsQueuePage` / `TeamLeadQueuePage`
Mock: left phone in approved-mock-option-b-daylight.html.
- **Summary strip** directly under the header: 4 equal white cells — Waiting · Washing · Check ·
  To pay — Benzin number + Gilmer label. Replaces the six stat tiles.
- **One scroll, grouped**, in this order, each group headed by a coloured square + caps label +
  count: **Your move** (cars at Final check, i.e. the team lead's job) → **Waiting** → **Washing**
  → **Final check** (if not already in Your move) → **To pay** → **Done** (collapsed by default,
  "Show 12 done").
- **Car card:** white, 10px radius. Row 1: plate chip · car (Gilmer 700, 16px) · time on the right
  ("12 min", red `--bad` when past the existing late threshold the page already uses). Row 2: meta
  ("Wash + wax · Medium"), "NEXT" tag on the first waiting car. Crew avatars (initials) when assigned.
- **Actions on the card**, using the existing handlers:
  - Waiting → primary "Start · pick crew" (opens the existing assign flow).
  - Final check (team lead only) → green "Send to pay" + outlined "Redo".
  - Other stages: no inline button; tap the card to open the existing detail.
  The "Your move" card gets a blue border + soft ring.
- Plate/phone history: open from search results (the existing panel), not a permanent block.
- Waiting time: show **longest wait** as "12 min" style; never hours-and-minutes above a day —
  if a value is absurd (e.g. 1414h) the data is stale; show "—" rather than the number.

### 5b. Crew time clock — `AttendancePage` (label it **Time clock**, route unchanged)
Mock: right phone in approved-mock-option-b-daylight.html.
- Header subtitle: "Shift starts at 8:00 AM · 8 min from now" (from data the page already has; if
  shift start isn't loaded, omit the line).
- **Status card:** icon in an amber circle + "You're not clocked in" / "Tap the button when you
  arrive". Under it, a checklist built from the existing geofence/permission state:
  ✓ "You're at Hakum Bacoor" · ✓ "Location is on" · "On time until 8:00 AM". Failed checks show
  in `--bad` with the fix ("Turn on location for this site").
- **One big button:** "Clock in now" (blue, 62px, full width). After clock-in it becomes
  "Clock out". Same handlers as today.
- **This week:** 7 small bars (Mon–Sun), orange = late, with "31h 20m" total and one line:
  "Orange = late. Late days still earn, at a smaller share." Only if the page already loads this
  history; otherwise omit the card.
- Remove the two explanatory paragraphs about the geofence; the checklist replaces them.

### 5c. Admin "Today" — `OperationsDashboardPage` / `SuperAdminFloorBoard` (label **Today**,
route `/operations/dashboard` unchanged)
Mock: desktop frame in approved-mock-option-b-daylight.html.
- Title "TODAY", subline "Saturday, 11 October · updated just now".
- **4 KPI cards:** Cars today · On the floor now · Waiting to pay (₱) · Sales today (₱), each with a
  small comparison line already computed by the page (omit if not available).
- **Where the cars are:** horizontal bars per stage (Waiting, Washing, Final check, Redo, To pay,
  Done) with counts, "Open queue →". Below it **Detailing jobs** bars (Working on, Final check,
  Ready to release), "Open bookings →". Use the existing stage counts; the bars are just widths.
- **To do today** card: up to 3 items the page can already derive (e.g. a car waiting long at
  final check, crew not clocked in, a daily sheet not sent), each with an icon chip and a link
  ("Open", "See who"). Links only — no new actions.
- Stat tiles must not show "•••" while loading: reserve their size with a soft skeleton.

### 5d. Everything else
Once the shell + shared components are done, the remaining pages (POS, Bookings, CRM, Finance,
Inventory, Planner, Settings, …) mostly inherit the look. Restyle the shared kit so they follow:
`src/components/ops/OpsPageShell.jsx`, `OpsStatTile.jsx`, `StatusBadge.jsx`, `FilterBar.jsx`,
`OpsTabBar.jsx`, `OpsEmptyState.jsx`, `OpsErrorState.jsx`, `OpsSkeleton.jsx`, `OpsGuideCard.jsx`,
`DataTable.jsx`, `ResponsiveSheet.jsx`, `ConfirmDialog.jsx`. Do not rewrite page logic.

## 6. Words (glossary — use everywhere in the portal UI)

| Today | Use |
|---|---|
| Attendance | **Time clock** (label only; route stays `/operations/attendance`) |
| Floor Board | **Today** |
| Services Failed QA / Detailing Failed QA | **Redo** |
| Final Checking | **Final check** |
| For Payment | **To pay** |
| Completed | **Done** |
| In timeline / Live (as tile captions) | remove |
| Geofence / geofenced | "You're at Hakum ‹branch›" / "You can only clock in at the branch" |
| Waiting avg 1414h 43m | "Longest wait 12 min" |

Stage words are display labels only. Never change the stored status values.

## 7. Accessibility and quality bar
- Text ≥ 4.5:1 contrast (meta text `--ink-3` on white passes; don't go lighter).
- Every tap target ≥ 44×44px, ≥ 8px apart. Icon-only buttons have `aria-label`.
- Status is never colour alone: always a word (and ideally an icon).
- Visible focus ring: 2px `--blue` (on navy: `--accent`), 2–3px offset.
- No horizontal scroll at 375px. Test 375, 768, 1024, 1440.
- `prefers-reduced-motion`: no transforms/animations.
- Headings in order; one `h1` per page.

## 8. How to work in this repo
- **Read `CHANGES.log` first and append to it** after each step (date, what, files, test results).
  It is the handoff between agents.
- **Don't touch other people's uncommitted work.** At handoff time these were uncommitted and are
  not yours: `src/components/public/home/PpfPackagesSection.{css,jsx}`,
  `tests/bredesignPublicPages.browser.test.js`, `tests/publicBranding.test.js`, the new public
  `src/components/public/SiteFooter.*` / homepage / footer work, `src/pages/CustomerAccountPage.jsx`,
  `src/styles/customer-native.css`, everything under `design-mocks/`, and this `docs/handoff/` folder. Run `git status` and
  leave anything you didn't create alone.
- **Don't commit or push unless Kirk asks.** If asked, branch first; commit only your files.
- **Mocks before code for anything not in the approved mock.** If you want to deviate from the mock or add
  a screen it doesn't show, make a before/after HTML mock and get Kirk's approval first.
- **Many tests read source text** (e.g. `tests/opsShell.test.js`, `opsDesignKit.test.js`,
  `floorStatusCards.test.js`, `attendance*.test.js`, `floorBoard*.test.js`, `adminPortal.test.js`).
  When one fails because it asserted an old class name or label, update the assertion to the new
  presentation **only if the behaviour it guards is unchanged**. If a test guards behaviour
  (permissions, money, status transitions, TL-only final check), the test is right and your change
  is wrong.
- After code changes run `graphify update .` (keeps the knowledge graph current).

## 9. Verify before you say done
```
npm test
npm run lint
npm run build
```
Browser tests need the built site served on port 4173 first (`npm run preview -- --port 4173`),
then `npm run test:browser`. As of 11 Oct, 4 browser tests already fail on `main` regardless of
portal work (stamp-card copy, services description at 1024px, services catalog, wash rail) — don't
chase those, but don't add new failures.

Screens behind login: **do not type staff passwords into a browser pointed at the live Supabase
project, and don't look for passwords in the repo** (they were removed in BUG-088). Ask Kirk to sign
in, or for a local/test account, and take screenshots at 375 / 768 / 1440 of: TL queue, crew time
clock, admin Today, and one other page per shell. Put before/after shots in `e2e-evidence/` and list
them in CHANGES.log.

Report honestly: what changed, what was left out and why (e.g. data not available), test results
with numbers, and any test you changed and why.
