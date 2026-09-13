# Role × route matrix (code-actual)

Generated from `src/auth/permissions.js` (`allowRoute` + `getOperationsNav`). Customer portal is separate (`/account/*`). Marketing landing `/home` out of scope.

## Legend

- **A+N** = allowRoute true and in ops nav
- **A** = allowRoute true, not primary nav (deep-link / overflow / intentional)
- **N!** = in nav but allowRoute false (P0)
- **—** = denied

## Branch Admin hard allowlist

`dashboard, queue, attendance, pos, inventory, reviews, planning, roadmap, history, my-pay, audit`

| Route | BossMich | asa_full | asa_bare | admin | operations_lead | team_lead | staff | sales | marketing | detailer | video_editor | investor |
|-------|---|---|---|---|---|---|---|---|---|---|---|---|
| `console` | A+N | A+N | A+N | — | — | — | — | — | — | — | — | — |
| `dashboard` | A+N | A+N | A+N | A+N | A+N | A+N | — | — | — | — | — | — |
| `queue` | A+N | A+N | A+N | A+N | A+N | A+N | — | — | — | — | — | — |
| `queue-new` | A | A | A | — | A | A | — | — | — | — | — | — |
| `bookings` | A+N | A+N | A+N | — | — | — | — | A+N | A+N | A+N | — | — |
| `crew` | A+N | A+N | A+N | — | A+N | A+N | — | — | — | — | — | — |
| `attendance` | A+N | A+N | A+N | A+N | A | A+N | A+N | — | A | A+N | A | — |
| `kpi` | A+N | A+N | A+N | — | A+N | A+N | — | — | — | — | — | — |
| `my-tasks` | A | A+N | A+N | — | A | A+N | A+N | — | — | A+N | A+N | — |
| `pos` | A+N | A+N | A+N | A+N | A+N | — | — | — | — | — | — | — |
| `inventory` | A+N | A+N | A+N | A+N | — | — | — | — | — | — | — | — |
| `crm` | A+N | A+N | A+N | — | — | — | — | — | A+N | — | — | — |
| `reviews` | A+N | A+N | A+N | A+N | A+N | — | — | — | — | — | — | — |
| `memberships` | A+N | A+N | A+N | — | — | — | — | — | — | — | — | — |
| `finance` | A+N | A+N | A+N | — | A+N | — | — | — | — | — | — | A+N |
| `payroll` | A+N | A+N | A+N | — | — | — | — | — | — | — | — | — |
| `my-pay` | — | A+N | A+N | A+N | A+N | A+N | A+N | A+N | A+N | A+N | A+N | — |
| `planning` | A+N | A+N | A+N | A+N | A+N | A+N | A+N | — | A+N | — | A+N | — |
| `roadmap` | A+N | A+N | A+N | A+N | A+N | — | — | — | — | — | — | — |
| `history` | A+N | A+N | A+N | A+N | A+N | A+N | — | A+N | A+N | — | — | — |
| `notifications` | A+N | A+N | A+N | — | — | — | — | — | A+N | — | — | — |
| `people` | A+N | A+N | A+N | — | — | — | — | — | — | — | — | — |
| `branches` | A+N | A+N | A+N | — | — | — | — | — | — | — | — | — |
| `cars` | A+N | — | — | — | — | — | — | — | — | — | — | — |
| `content` | A+N | A+N | A+N | — | — | — | — | — | — | — | — | — |
| `audit` | A+N | A+N | A+N | A+N | A+N | — | — | — | — | — | — | — |
| `data-center` | A+N | — | — | — | — | — | — | — | — | — | — | — |
| `inquiries` | A+N | A+N | A+N | — | — | — | — | — | — | — | — | — |
| `settings` | A+N | A+N | A+N | — | A | — | — | — | — | — | — | — |
| `reports` | A | A | A | — | — | — | — | — | — | — | — | A |

## Homes + shells

| Persona | Role | Home | Shell |
|---------|------|------|-------|
| BossMich | `BossMich` | `/operations/console` | command |
| asa_full | `assistant_super_admin` | `/operations/console` | command |
| asa_bare | `assistant_super_admin` | `/operations/console` | command |
| admin | `admin` | `/operations/pos` | command |
| operations_lead | `operations_lead` | `/operations/roadmap` | command |
| team_lead | `team_lead` | `/operations/queue` | floor |
| staff | `staff` | `/operations/attendance` | floor |
| sales | `sales` | `/operations/bookings` | floor |
| marketing | `marketing` | `/operations/crm` | floor |
| detailer | `detailer` | `/operations/bookings` | floor |
| video_editor | `video_editor` | `/operations/planning?tab=calendar` | floor |
| investor | `investor` | `/operations/finance` | command |

## Nav vs allow notes

- **BossMich**: navButDenied=[—] allowButNoNav=[my-tasks]
- **operations_lead**: navButDenied=[—] allowButNoNav=[attendance,my-tasks,settings]
- **marketing**: navButDenied=[—] allowButNoNav=[attendance]
- **video_editor**: navButDenied=[—] allowButNoNav=[attendance]

`allowButNoNav` is usually intentional (deep-link / overflow / grant surface without primary nav). `navButDenied` is a P0.

## Wave A P0 fixed

- Detailer removed from `QUEUE_VIEWER_ROLES` so wash Queue / Floor / Crew / KPI deep-links deny (Bookings-only IA).
- Puppeteer landing tests renamed to `*.browser.test.js` so `npm test` stays preview-free.
