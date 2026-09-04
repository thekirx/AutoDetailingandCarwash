# Hakum — QA Bug Register

**Rule:** Every defect needs severity, evidence, and status. Do not close without fresh command output.

| ID | Severity | Area | Problem | Evidence | Status | Fix |
|----|----------|------|---------|----------|--------|-----|
| BUG-001 | Medium | Ops / deploy | Browser Playwright/UI E2E missing historically | `SYSTEM_GAPS.md` #3 | Open → addressed by `scripts/e2e-ui-p0.mjs` | Phase C harness |
| BUG-002 | High | SMS / prod | Vercel egress IP not on BrandTxt whitelist | `docs/OPS/BUSYBEE-PRODUCTION.md` VERCEL-SMS-IP | Open (ops) | Whitelist static IPs |
| BUG-003 | Medium | SMS / ops | `OWNER_SMS_PHONE` may be unset on Vercel | OWNER-SMS-ENV | Open (ops) | Set env + verify |
| BUG-004 | Medium | Inventory | Sunday chemical recon data incomplete | CHEM-RECON | Open | Seed/recon flow |
| BUG-005 | Low | SMS | `sms_events` rows `post_service_completed` stay `pending` after status SMS DELIVRD | Live query 2026-09-03 on bookings `ed71b044` / `7e76827a` | Open | Trace writer; send or drop dead queue |
| BUG-006 | Low | CRM | Duplicate active customer rows historically shared phone `09625294043` | Pre-E2E query | Mitigated | Archive dups in `e2e-real-customer-status-sms.mjs` |
| BUG-007 | High | Ops E2E | Full browser TL→POS→EoS→Finance→payroll not proven | OWNER-REVISIONS OPS-E2E | Partial | `e2e-ui-money` proves TL deny + admin EoS wizard open + boss finance shift-close tab; `e2e-shift-close-money` proves BA submit_shift_close and finance `review_shift_close` accept (QA sandbox). Payroll end-to-end still not proven. |
| BUG-009 | Low | Tests | Stale source contracts: BA nav denied inventory; POS `SHELL_TABS`/`max-w-7xl`/`Sell merch` copy; detailing→coating bucket; PLANNER_TABS only on page | `npm test` 9 fails → 0 after update | Closed | Updated tests to match intentional product (BA restock inventory, `POS_SHELL_TABS` in `posInsights.js`, detailing honesty) |
| BUG-010 | Medium | Live e2e | `e2e-pos-part2` assumed TL cannot provision queue / wrong `custom-size` normalize | pos-part2 false fail | Closed | TL is in `QUEUE_PROVISION_ROLES`; `normalizeVehicleType('custom-size')` → `custom_size` |
| BUG-011 | High | UI harness | Authed screenshot treated `/operations/access-denied` as success (TL→POS false-green) | `screenshotAuth.mjs` | Closed | Reject access-denied / forbidden URLs |
| BUG-012 | Medium | Customer portal | `/account` horizontal overflow / false FAIL from chip bleed math | `responsive-validation.mjs` | Mitigated | clip + user-scrollX gate; last run CONDITIONAL exit 0 |

## Severity guide

- **Critical** — data loss, auth bypass, wrong money posted
- **High** — core workflow broken or false-green in production
- **Medium** — feature gap / ops blocker without workaround
- **Low** — hygiene, redundancy, cosmetic

## How to add

1. Reproduce with one command.
2. Add a row (next ID).
3. Link fix commit when closed.
