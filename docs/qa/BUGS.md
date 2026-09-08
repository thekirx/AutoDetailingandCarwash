# Hakum — QA Bug Register

**Rule:** Every defect needs severity, evidence, and status. Do not close without fresh command output.

| ID | Severity | Area | Problem | Evidence | Status | Fix |
|----|----------|------|---------|----------|--------|-----|
| BUG-001 | Medium | Ops / deploy | Browser Playwright/UI E2E missing historically | `SYSTEM_GAPS.md` #3 | Open → addressed by `scripts/e2e-ui-p0.mjs` | Phase C harness |
| BUG-002 | High | SMS / prod | Vercel egress IP not on BrandTxt whitelist | `docs/OPS/BUSYBEE-PRODUCTION.md` VERCEL-SMS-IP | Open (ops) | Whitelist static IPs |
| BUG-003 | Medium | SMS / ops | Owner SMS phone was unset | Local `.env` + BossMich.phone=`09625294043`; live `notify_sent sent=1` 2026-09-07 | Mitigated (local/QA) | Still set on **Vercel** + whitelist Vercel IPs |
| BUG-004 | Medium | Inventory | Sunday chemical recon data incomplete | CHEM-RECON; QA seeded 1 line 2026-09-07 | Mitigated (QA) | Ops still needs weekly BA→SA recon habit |
| BUG-005 | Low | SMS | Legacy `post_service_completed` rows stuck `pending` (no writer in current code) | 19 orphans cancelled 2026-09-07; pending count **0** | **Closed** | Marked `cancelled`; live status SMS uses `booking_status` |
| BUG-006 | Low | CRM | Duplicate active customer rows historically shared phone `09625294043` | Pre-E2E query | Mitigated | Archive dups in `e2e-real-customer-status-sms.mjs` |
| BUG-007 | High | Ops E2E | Full browser TL→POS→EoS→Finance→payroll not proven | OWNER-REVISIONS OPS-E2E | Partial→RPC **MET** | UI: `e2e-ui-money`. RPC: `e2e-shift-close-money` 13/13. |
| BUG-013 | Medium | Planning UX | Experience tickets easy to miss / silent create failure | oldest-board vs Cash Advance default; no toast | **Mitigated** | Prefer `Planner` board; toast on `experienceCard`; QA seed card on Experience list |
| BUG-009 | Low | Tests | Stale source contracts: BA nav denied inventory; POS `SHELL_TABS`/`max-w-7xl`/`Sell merch` copy; detailing→coating bucket; PLANNER_TABS only on page | `npm test` 9 fails → 0 after update | Closed | Updated tests to match intentional product (BA restock inventory, `POS_SHELL_TABS` in `posInsights.js`, detailing honesty) |
| BUG-010 | Medium | Live e2e | `e2e-pos-part2` assumed TL cannot provision queue / wrong `custom-size` normalize | pos-part2 false fail | Closed | TL is in `QUEUE_PROVISION_ROLES`; `normalizeVehicleType('custom-size')` → `custom_size` |
| BUG-011 | High | UI harness | Authed screenshot treated `/operations/access-denied` as success (TL→POS false-green) | `screenshotAuth.mjs` | Closed | Reject access-denied / forbidden URLs |
| BUG-012 | Medium | Customer portal | `/account` horizontal overflow / false FAIL from chip bleed math | `responsive-validation.mjs` | Mitigated | clip + user-scrollX gate; last run CONDITIONAL exit 0 |
| BUG-014 | High | Customer auth | `vite preview` (:4173) `/api/customer-auth-lookup` **404** → demo email sign-in fail; stale session showed `/auth/v1/user` **403** | Console + UI “Invalid phone or password” | **Closed** | `configurePreviewServer` mounts APIs; email `signInWithPassword` fallback; idMode auto-switch; verified 200 → `/account` |
| BUG-015 | High | Events / security | Public event registration: anon INSERT + client-only honeypot | SYSTEM_AUDIT 2026-09-08; RLS `WITH CHECK (true)` | **Closed** | API `event_registration` + migration `20260908120000_event_registrations_api_geofence` applied |
| BUG-016 | Medium | Public UX | “Join the waitlist” on coming-soon branches has no waitlist | `BdEventsBranches.jsx` | **Closed** | CTA → “Ask about opening” + `/contact` |
| BUG-017 | Medium | DX / CI | `npm test` browser suites fail without vite preview on `:4173` | 12× `ERR_CONNECTION_REFUSED` cold run | **Closed** | Default `npm test` excludes `*.browser.test.js`; use `npm run test:browser` with preview |
| BUG-018 | Low | Legal copy | Legal pages claim “contact form”; `/contact` is channels-only | `LegalPages.jsx` vs `ContactPage.jsx` | **Closed** | Copy → Contact page links |

## Severity guide

- **Critical** — data loss, auth bypass, wrong money posted
- **High** — core workflow broken or false-green in production
- **Medium** — feature gap / ops blocker without workaround
- **Low** — hygiene, redundancy, cosmetic

## How to add

1. Reproduce with one command.
2. Add a row (next ID).
3. Link fix commit when closed.
