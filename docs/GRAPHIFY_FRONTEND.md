# Graphify frontend + API seams

## Route map (`src/App.jsx`)

### Public
`/home`, `/services`, `/services/:slug`, `/book` (detailing), `/queue`, `/branches`, `/partnerships`, `/contact`, `/complaints`, `/events`, `/events/:slug`, `/blog`, `/blog/:slug`, `/f/:slug`, legal (`/terms` `/privacy` `/cookies`), `/403` `/404`.

### Customer (ProtectedRoute role=customer)
`/account`, `/account/blog`, `/account/events`, `/account/queue`, `/account/book`, `/account/loyalty`, `/account/more`; auth `/signin` `/signup` `/account/set-password`.

### Kiosk
`/queue/:branch`, `/queue/:branch/tv` (DEFINER views).

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
| settings, settings/pos, settings/payroll | settings |
| content | content |
| notifications, broadcast | notifications |
| history | history |
| reports | reports |
| memberships | memberships |
| reviews | reviews |

Login: `/operations/login`. Legacy `/admin/*` redirects into operations.

## `allowRoute` keys → permission functions

`planning→canViewPlanning`, `roadmap→canAccessOpsRoadmap`, `people→canManagePeople`, `branches→canManageBranches`, `cars→canManageVehicleCatalog`, `audit→canAccessAudit`, `data-center→canAccessDataCenter`, `inquiries→canAccessInquiries`, `dashboard|queue|kpi→canViewQueueOperations`, `queue-new→canEditQueueOperations`, `attendance→canAccessAttendance`, `my-tasks→canViewAssignedTasks`, `pos→canAccessPos`, `inventory→canAccessInventory`, `finance→canOpenFinanceHub`, `payroll→canAccessPayroll`, `my-pay→canViewOwnPay`, `crm→canAccessCrm`, `bookings→canAccessBookingBoard`, `reviews→canAccessReviews`, `reports→canAccessReports`, `memberships→canAccessMemberships`, `settings→canAccessSettings`, `content→canManageSiteContent`, `notifications|history→canAccess*`. Branch admin uses `BRANCH_ADMIN_ROUTE_KEYS` allowlist instead of the map.

## Detailer vs Queue viewer (resolved)

Detailer is on queue **viewer** capabilities for floor visibility / Failed QA context but **home/dock is Bookings**. Detailing SKUs never create wash Queue tickets (`serviceKinds` + queueApi reject). Sales home is Bookings (`US-SALES-01`).

## `/api/*` gateway

Vite `attachHakumApis` + Vercel `api/{bookings,customer,data-center,finance,notifications,public-inquiry,staff}.js` → `server/*.mjs`.

Paths: provision-customer/staff, update-staff, customer-portal/signup/auth-lookup/history, public-book/inquiry, plate-lookup, booking-status, maintenance-schedules, push-subscribe/send-push, notify-* (booking, ops-form, planner, pos, shift-close, ops-lab), lifecycle-sms, busybee, notification-*, birthday-greetings, send-finance-quote, data-center.

**Floor money stays PostgREST RPC**, not these routes.

## Public content note

`src/components/public/bredesign/content.js` is mostly static `IMAGES` URL map — AST extract yields almost no symbols. Treat tests `bredesign*.browser.test.js` + ServiceDetail rails as the graph entry.
