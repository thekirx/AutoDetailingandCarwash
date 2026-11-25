# Graphify frontend + API seams

## Route map (`src/App.jsx`)

### Public
`/home` (`noindex`), `/services`, `/services/:slug` (`ppf`, `ceramic`, `tint`, `wash-detailing`), `/tint-finder`, `/shop`, `/book` (detailing), `/queue`, `/branches`, `/branches/:citySlug` (`bacoor`, `batangas`, `imus`, `cavite`, `dasmarinas`), `/branches/:citySlug/:serviceSlug` (`car-wash`, `auto-detailing`, `ceramic-coating`, `ppf`, `window-tint`), `/partnerships`, `/contact`, `/complaints` (`noindex`), `/events`, `/events/:slug`, `/blog`, `/blog/:slug`, `/f/:slug`, legal (`/terms` `/privacy` `/cookies`), `/403` `/404`.

### Customer (ProtectedRoute role=customer)
`/account` (Home & active visit card + past visits/purchases), `/account/queue` (live queue + branch weather), `/account/book` (2+ calendar day detailing booking wizard), `/account/visit` & `/account/visit/:id` (live step timeline, voucher apply & one-time reschedule request), `/account/pickup/:id` (points shop handover pickup code), `/account/loyalty` (10-slot stamp track, Visit 6–30 milestones, member tier, points shop), `/account/referral` (friend code share/copy), `/account/vouchers` (birthday free wash claim `BDxxxx` & `VKxxxx` promo code verifier), `/account/cars` (Digital Garage with plate, vehicle size & icon presets), `/account/more` (Profile lock birthdate, BusyBee SMS opt-in, Web Push, Dark/Light theme, PWA install), `/account/events`, `/account/blog`; auth `/signin` `/signup` `/account/set-password`.

### Customer Concierge Chatbot (Movable, Deterministic — No AI)
- Host: `src/components/HakumChatbotHost.jsx` mounted in `src/App.jsx` for all public + `/account/*` customer app screens (strictly excluded on `/operations/*`, `/admin/*`, `/app`, and `/queue/*/tv`).
- Widget: `src/components/HakumChatbot.jsx` + `src/components/HakumChatbot.css` (draggable pointer UI with `localStorage` position persistence, viewport clamping, Double-Bezel obsidian-glass panel, Main Menu 6-category grid, non-invasive Studio Spotlight promo card, interactive `S/M/L/XL` vehicle-size price switcher, scrollable suggested prompt pills, and direct **Facebook Messenger** (`https://m.me/61573318005308`) & **Hakum Facebook Page** (`https://www.facebook.com/profile.php?id=61573318005308`) human handoff links).
- Engine & Data: `src/lib/hakumChatbotEngine.js`, `src/data/hakumChatbotKnowledge.js`, `src/lib/hakumChatbotLiveCatalog.js`, `src/lib/chatbotSettingsRules.js`, `src/lib/chatbotSettings.js`.
- Owner Control: `/operations/settings/chatbot` (`src/pages/settings/ChatbotSettingsPage.jsx`, Super Admin `BossMich` only via `isSuperAdmin`) persisting ON/OFF visibility, greeting, accent preset, Facebook/Messenger handoff URLs, featured product spotlight, and suggested prompts to `app_settings.chatbot_widget` (read publicly via `SECURITY DEFINER` RPC `get_public_chatbot_settings()`).

### Kiosk
`/queue/:branch`, `/queue/:branch/tv` (narrow `SECURITY DEFINER` RPCs: `get_public_queue_counts`, `get_public_queue_floor`, `get_public_home_stats`).

### Staff (`/operations/*` + OpsRoleGate)
| Path | allowRoute key |
|------|----------------|
| people | people |
| branches | branches |
| cars | cars |
| audit | audit |
| data-center | data-center |
| inquiries | inquiries |
| dashboard | dashboard |
| queue, queue/:id | queue |
| queue/new | queue-new |
| attendance | attendance |
| kpi | kpi |
| my-tasks | my-tasks |
| pos | pos |
| inventory (+ redirects services/products) | inventory |
| finance | finance |
| payroll | payroll |
| my-pay | my-pay |
| crm (+ sms redirect) | crm |
| bookings | bookings |
| planning | planning |
| roadmap | roadmap |
| settings, settings/pos, settings/tint-finder, settings/chatbot, settings/daily-sheet | settings (tint-finder & chatbot restricted to `BossMich`) |
| content | content |
| notifications, broadcast | notifications |
| history | history |
| reports | reports |
| memberships | memberships |
| reviews | reviews |

Login: `/operations/login`. Legacy `/admin/*` redirects into operations.

## `allowRoute` keys → permission functions

`planning→canViewPlanning`, `people→canManagePeople`, `branches→canManageBranches`, `cars→canManageVehicleCatalog`, `audit→canAccessAudit`, `data-center→canAccessDataCenter`, `inquiries→canAccessInquiries`, `dashboard|queue|kpi→canViewQueueOperations`, `queue-new→canEditQueueOperations`, `attendance→canAccessAttendance`, `my-tasks→canViewAssignedTasks`, `pos→canAccessPos`, `inventory→canAccessInventory`, `finance→canOpenFinanceHub`, `payroll→canAccessPayroll`, `my-pay→canViewOwnPay`, `crm→canAccessCrm`, `bookings→canAccessBookingBoard`, `reviews→canAccessReviews`, `reports→canAccessReports`, `memberships→canAccessMemberships`, `settings→canAccessSettings`, `content→canManageSiteContent`, `notifications|history→canAccess*`. Branch admin uses `BRANCH_ADMIN_ROUTE_KEYS` allowlist instead of the map.

## Detailer vs Queue viewer (resolved)

Detailer is on queue **viewer** capabilities for floor visibility / Failed QA context but **home/dock is Bookings**. Detailing SKUs never create wash Queue tickets (`serviceKinds` + queueApi reject). Sales home is Bookings (`US-SALES-01`).

## `/api/*` gateway

Vite `attachHakumApis` + Vercel `api/{bookings,customer,data-center,demo-login,finance,health,notifications,public-inquiry,seo,staff}.js` (`10` functions under Hobby `12` cap) → `server/*.mjs`.

Paths: provision-customer/staff (`server/staffAuth.mjs`), update-staff, smart-search, customer-portal/signup/auth-lookup/history, public-book/inquiry (`partnership`, `complaint`, `tint_finder`, `ops_form`, `shop_inquiry`), plate-lookup, booking-status, maintenance-schedules, push-subscribe/send-push, notify-* (booking, ops-form, planner, pos, shift-close, ops-lab), lifecycle-sms, busybee, notification-*, notification-templates, notification-broadcast-kinds, birthday-greetings, send-finance-quote, data-center, `seo` (`sitemap`, `rss`, `home-meta`, `branches-meta`, `branch-meta`, `branch-service-meta`, `service-meta`, `blog-meta`, `event-meta`, `indexnow-key`). Public `/shop` calls RPC `get_public_shop_catalog()`.

**Floor money stays PostgREST RPC**, not these routes.

## Public content note

`src/components/public/bredesign/content.js` is mostly static `IMAGES` URL map — AST extract yields almost no symbols. Treat tests `bredesign*.browser.test.js` + ServiceDetail rails as the graph entry.
