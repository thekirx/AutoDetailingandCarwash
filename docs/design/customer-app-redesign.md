# Customer app redesign plan

Source: 8-screen dark mockup (Sign in, Home, Book, Queue, Loyalty, Blog, Events, Settings).
Mode: redesign-overhaul. Content, routes under `/account`, and the backend contract stay; visuals and IA change.

## Design read

- Product: customer PWA for car owners (phone first, desktop web under the landing header).
- Language: dark navy app shell, one electric-blue accent, soft 16-20px cards on 1px hairlines, pill filters, status badges, 5-tab dock.
- Dials: variance 4, motion 4 (150-300ms transforms only), density 5.
- Fonts: existing Benzin (display) + Gilmer (body). Icons: lucide-react (already a dependency, 1.75 stroke).
- Theme lock: the whole customer app is dark. The customer-only light/dark toggle is removed.

## Tokens (scoped to `.capp`, `src/styles-customer-app.css`)

| Token | Value | Use |
|---|---|---|
| `--capp-bg` | `#060c24` | page |
| `--capp-surface` | `#0c1535` | cards |
| `--capp-surface-2` | `#121d47` | tiles, chips, inputs |
| `--capp-line` | `rgba(255,255,255,0.08)` | hairlines |
| `--capp-ink` | `#f1f4ff` | text |
| `--capp-steel` | `#8e98bd` | muted text |
| `--capp-accent` | `#3b7bff` | links, active tab, progress fill, selected card |
| `--capp-btn` | `#e9eefc` | primary button fill (navy text) |
| status | `--status-*` tokens from `design-tokens.css` | badges (semantic only) |

Radius: cards 1.15rem, tiles/rows 0.95rem, pills/buttons 999px.

## Information architecture

Dock (5): Home `/account`, Book `/account/book`, Queue `/account/queue`, Blog `/account/blog`, More `/account/more`.
Secondary: Events `/account/events` (from Home tile + More), Loyalty `/account/loyalty` (from Home tile + loyalty card).

## Components (`src/components/customer/`)

| Component | Data binding |
|---|---|
| `VisitProgress` | `booking.visit.steps[]`, `currentIndex`, `isComplete` from `/api/customer-portal` (`buildVisitProgress(status)`) |
| `ActiveVisitCard` | active `bookings[0]`: `service_name`, `branch`, `queue_label`, `vehicle_plate`, `visit`, `update_photos` |
| `CustomerUi` primitives | `SectionHead` (label + View all), `Tile` (quick action), `Pills` (filters), `Row` (icon / title / sub / trailing), `Badge` (status tone), `Stat` |

## Screens

1. Sign in / sign up: dark customer variant of `HakumAuthShell` on phones (`hakum-auth--app`). Ops login unchanged.
2. Home: greeting by time of day, bell + avatar (opens More); Active visit card with progress bar or "No active visit" card with Book CTA; 2x2 quick actions (Book, My Cars, Loyalty, Events); Live queue for the nearest / chosen branch (3 stat tiles + View all); rate last visit; birthday perk; loyalty summary; Activity (Past visits / Purchases).
3. Book: branch card, garage picker or plate + brand/model, size pills, service cards with "From ₱" (`formatSizePriceRange`), next-7-days date strip + time, Continue posts to `/api/public-book`.
4. Queue: branch pills, live bar, 3 stat tiles, "Your cars on this floor" ticket rows (queue label, status badge, progress), other branches.
5. Loyalty: stamps X / slots grid (`repeat(5, minmax(0, 1fr))`), next reward from `milestones`, points and membership when enabled.
6. Blog: All pill (no category column exists), cards with cover, title, excerpt, date, real read-time from `content_blocks`.
7. Events: Upcoming / Past pills (real `starts_at` filter), date block cards, CTA to attached `ops_forms` when published.
8. More: profile card, rows (Profile, My Cars, Notifications, SMS alerts, Test SMS, Help, Sign out); sub-views reuse the existing forms.

Not faked: estimated wait minutes, blog categories, promos.

## Responsive

- < 860px: app shell, fixed island dock, safe-area insets, phone-landscape side dock.
- >= 860px: landing header stays, dock becomes an inline tab row, content in `min(1120px, 100% - 3rem)`.
- >= 1024px: Home / Queue scroll area becomes 2 columns, wide cards span both.
- Evidence: `node scripts/responsive-validation.mjs` -> `docs/qa/responsive-report.md`.

## Verification (2026-09-04)

- Customer frame tests pass (5-tab dock, VisitProgress, light/dark tokens, Add a car deep-link).
- Theme + viewport matrix: `e2e-evidence/customer-app/phone-375-{light|dark}-*.png` — zero overflow, brand lockup ~168x46, progress bar when a visit is present, Add a car on empty home + garage `?add=1`.
- Report: `docs/qa/responsive-report.md` (PASS).
- Brand PNGs are square with heavy padding; `.capp-brand` crops via `transform: scale(1.7)` (same pattern as `.command-rail-logo`).
