# Push notification checklist

**Audit date:** 2026-10-05 (Asia/Manila) · **Rule source:** `NOTIFY_EVENTS` in [`src/lib/notifyRouting.js`](../../src/lib/notifyRouting.js)

**Delivery status (production SQL):** **0** active staff devices subscribed · only demo-customer push rows remain. Routing unit tests pass; **phones will not ring until BossMich / ASA / each BA enable alerts** (Account → Enable alerts). **SMS not tested this pass.**

Branch rule: people assigned to a branch (Branch Admin, Team Lead, crew, detailer, sales, video) only get that branch's alerts (home branch + `staff_branch_assignments`). **Super Admin, ASA, Ops Lead and Marketing are global.** Recipients are read live from `staff_profiles` at send time — not from old subscription rows.

## Who gets what (and where the tap lands)

| Event | Who is notified | Tap opens |
|-------|-----------------|-----------|
| Booking received / confirmed / cancelled / photos ready | The customer | `/account` |
| Booking on the floor (waiting → in progress → final check → release → payment, redo) | The customer | `/account/queue` |
| New booking / floor status at a branch | SA, ASA, Ops Lead + that branch's Branch Admin and Team Lead (detailer for detailing jobs) | Bookings / Queue / POS by status |
| TL assigns crew to a car | Only the assigned crew (just the new batch) | `/operations/my-tasks` |
| Branch Admin submits the Daily Sheet | SA + ASA with `finance_view` (not the submitter) | `/operations/finance?tab=sheets&sheet=…` |
| SA / ASA approves or returns the Daily Sheet | The Branch Admin who submitted it | `/operations/pos?tab=sheet&date=…` |
| Cash advance requested | That branch's Branch Admin (releases it on the Daily Sheet; SA / ASA approve it with the sheet) | `/operations/pos?tab=sheet` |
| Public partnership inquiry / complaint | SA + ASA | `/operations/inquiries` |
| Customer review | SA, ASA, Ops Lead + that branch's Branch Admin | `/operations/reviews` |
| Staff complaint form | SA, ASA + that branch's Branch Admin (global only if no branch) | `/operations/planning?tab=forms` |
| POS sale / expense | SA, ASA + that branch's Branch Admin (never the person who rang it) | `/operations/pos` (expenses tab for expenses) |
| Ops Lab board / card activity | SA, ASA, Branch Admin, Ops Lead (not the actor) | `/operations/roadmap?board=…` |
| Planner card assigned | Each assignee (marketing, video, crew, …) | A page that person can open (Planning or My tasks) |

Not sent by design: owner daily close SMS (Finance accept uses web push), inbound SMS replies, crew alerts for every booking (crew hear only about cars they are assigned).

## Automated proof

| Check | Result |
|-------|--------|
| Unit suite (`npm test`) incl. routing, recipients, sheet_reviewed → submitting BA only | Re-run after doc pass — see `PROJECT_STATUS.md` |
| `PUSH_AUDIT=1` real-browser event audit (Chrome) | **NOT RE-RUN** since Daily Sheet (2026-09-27 was 14/14 on older EoS events). Re-run after staff opt-in |
| Staff push subscriptions | **0** — soft-launch blocker for night alerts |

Evidence: `e2e-evidence/push-audit/` (audit toasts + `summary.json`), `e2e-evidence/push-real/` (browser matrix).

Re-run:

```powershell
npm run build; npx vite preview --port 5176 --strictPort --host 127.0.0.1
$env:BASE_URL='http://127.0.0.1:5176'; $env:PUSH_AUDIT='1'; $env:PUSH_BROWSERS='chrome'; node scripts/e2e-push-real.mjs
Remove-Item Env:PUSH_AUDIT; $env:PUSH_BROWSERS='chrome,edge,brave,firefox'; node scripts/e2e-push-real.mjs
```

## Phone checklist (you, on real phones)

Setup per phone:

- **iPhone (iOS 16.4+):** Safari → open the site → Share → **Add to Home Screen** → open Hakum **from the icon** → sign in → Account/Settings → **Enable alerts** → Allow. (Safari tabs cannot receive web push on iPhone.)
- **Android:** Chrome → open the site → sign in → **Enable alerts** → Allow. Installing to Home Screen is optional.
- Tap **Test alert** — you should see "Hakum alerts ready" within a few seconds.

Then do each row and tick it when the toast arrives **and** the tap opens the right page. Lock the phone for at least one row per persona (background delivery).

| # | Sign in as (phone) | Someone else does | Expect toast | Tap opens | iPhone | Android |
|---|--------------------|-------------------|--------------|-----------|--------|---------|
| 1 | Customer | Books a wash, TL moves it to the queue | "In the queue" | Account → Queue | ☐ | ☐ |
| 2 | Customer | TL moves it to Ready for release / payment | "Ready for release" / "Ready for payment" | Account → Queue | ☐ | ☐ |
| 3 | Team Lead (Bacoor) | Customer books at Bacoor | New booking | Operations → Bookings/Queue | ☐ | ☐ |
| 4 | Team Lead (Bacoor) | Customer books at **another** branch | **Nothing** | — | ☐ | ☐ |
| 5 | Crew | TL assigns that crew to a car | "New car assigned" (plate · service @ branch) | My tasks | ☐ | ☐ |
| 6 | Super Admin | Branch Admin submits the Daily Sheet | "Daily sheet to approve · Bacoor" | Finance → Daily sheets | ☐ | ☐ |
| 7 | Branch Admin (Bacoor) | SA approves or returns that sheet | "Daily sheet approved · Bacoor" / "Daily sheet returned · Bacoor" | POS → Daily sheet | ☐ | ☐ |
| 10 | Super Admin | Public partnership form / customer review | "New partnership inquiry" / "New review · N★" | Inquiries / Reviews | ☐ | ☐ |
| 11 | Branch Admin (Bacoor) | Bacoor crew requests a cash advance | "Cash advance request" | POS → Daily sheet | ☐ | ☐ |

Payroll, My pay and End of shift were retired on 2026-10-01 (pay is posted when the Daily Sheet is approved; old shift closes are read-only in Finance), so the "Pay posted", "Cash advance approved / declined", "End of shift to review / accepted / sent back" and "Floor pay ready" alerts are no longer sent from the app. Rows 8–9 were removed for that reason. The 14/14 audit below predates that change; re-run it after the Daily Sheet migration is live.

If a toast is missing: check the phone's notification settings for Hakum/Chrome, Focus/Do Not Disturb, and that the phone shows **Push alerts on** in the app. Tell me the row number and phone.

## Notes and limits

- Staff event alerts (crew assigned, Daily Sheet submit / review, cash advance request) are sent by `POST /api/notify-ops-event` right after the action succeeds in the app. The server re-checks who is allowed and picks recipients from the database; if the phone that did the action loses signal at that exact moment, that one alert is skipped (the action itself is saved).
- The ASA (Luci, `assistant@hakumautocare.com`) has every grant on since 2026-09-29, including `finance_write`, so she gets Daily Sheet submissions like the Super Admin. Daily Sheet submissions need `finance_view`, which is on by default for every ASA.
- DB function `resolve_ops_lab_notify_user_ids` is no longer called (Ops Lab now uses the shared recipient planner); left in place, safe to drop later.
- `scripts/e2e-push-notifications.mjs` and the browser matrix send real pushes to every device subscribed as the demo customer — phones signed in as the demo customer will show "E2E probe" / "In the queue · PUSHQA…" toasts while those scripts run.
- Test bookings created by the audit are archived (bookings are soft-deleted by the `bookings_soft_delete` trigger), not physically removed.
