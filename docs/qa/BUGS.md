# Hakum — QA Bug Register

**Rule:** Every defect needs severity, evidence, and status. Do not close without fresh command output.

| ID | Severity | Area | Problem | Evidence | Status | Fix |
|----|----------|------|---------|----------|--------|-----|
| BUG-001 | Medium | Ops / deploy | Browser Playwright/UI E2E missing historically | `SYSTEM_GAPS.md` #3 | Open → addressed by `scripts/e2e-ui-p0.mjs` | Phase C harness |
| BUG-002 | High | SMS / prod | BrandTxt Unauthorized IP (ErrorCode 11) | Egress `180.191.244.237` 2026-09-24; old whitelist `180.190.249.189` stale | **Open (ops)** | BrandTxt whitelist current office IP + Vercel Static IPs; prove with `npm run sms:egress` |
| BUG-003 | Low | SMS / ops | Owner daily SMS phone | Local QA historically | **Closed (policy)** | Product: **no owner SMS**; outbound reminders only; Finance accept → web push |
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
| BUG-019 | High | Auth / IA | Detailer deep-link could open wash Queue/Floor/Crew/KPI (`QUEUE_VIEWER_ROLES`) | Role QA Wave A matrix | **Closed** | Removed DETAILER from viewers; `principalQaMatrix` asserts deny; `detailer-deny.png` |
| BUG-020 | Medium | DX / CI | `bredesignLogoMarquee` (+ homepage sections) puppeteer in default unit suite | Cold `npm test` ERR_CONNECTION_REFUSED | **Closed** | Renamed to `*.browser.test.js` |
| BUG-021 | High | POS / authz | Empty POS payment allowlist accepted any method string | `isAllowedPosPaymentMethod([], …)` | **Closed** | Fallback cash/gcash/card; unit lock |
| BUG-022 | Medium | POS honesty | Expense “recorded” hid draft status; settings “Customize” overclaimed | Money-path audit | **Closed** | Draft copy + Counter options |
| BUG-023 | Critical | POS / money | Loyalty tile gave any item away free with no redemption | POS-DEEP-AUDIT P0-1 | **Closed** | Client + RPC stamp gate; hide button until earned |
| BUG-024 | High | POS / money | `complete_pos_sale` trusted client `unit_price_minor` | POS-DEEP-AUDIT P0-2 | **Closed** | Catalog re-price + discount reason + `sales.discount_*` |
| BUG-025 | Medium | POS | Every load 400 on `expense_categories.is_active` | POS-DEEP-AUDIT P1-1 | **Closed** | Removed dead query |
| BUG-026 | High | Ops UI | Phone tab strip hid Sell (`justify-center` overflow) | POS-DEEP-AUDIT P1-2 | **Closed** | `OpsTabList` `justify-start` |
| BUG-027 | Medium | POS / authz | BA saw editable POS settings; RLS blocked writes | POS-DEEP-AUDIT P1-4 | **Closed** | `canWritePosSettings` = SA / ASA finance_write |
| BUG-028 | High | Payroll / money | Merch/product lines inflated wash-pool base | PAYROLL-DEEP-AUDIT P0-2 | **Closed** | `isWashEligibleLine` drops product/merch/coffee |
| BUG-029 | High | Payroll honesty | ₱2,850 sales / ₱0 pool with no “nobody clocked in” | PAYROLL-DEEP-AUDIT P0-1 | **Closed** | `theoretical_pool_minor` + allocated copy |
| BUG-030 | High | Payroll / UX | Wizard and shirt fields bound to centavos | PAYROLL-DEEP-AUDIT P0-3 | **Closed** | `pesosFromMinor` / `minorFromPesos` |
| BUG-031 | Medium | Payroll | Inverted range + `wash_pool_pct` 150 accepted | PAYROLL-DEEP-AUDIT P1-1/2 | **Closed** | Range always validated; % clamped 0–100 |
| BUG-032 | Medium | Payroll / copy | Inventory `salary_pct` said preview-only | PAYROLL-DEEP-AUDIT P1-3 | **Closed** | Copy: paid on next floor run |
| BUG-033 | Medium | Payroll / authz | View-only ASA could edit Settings → Payroll | PAYROLL-DEEP-AUDIT P1-4b | **Closed** | `canWrite = canRunPayroll` |
| BUG-034 | Medium | Payroll / UX | “Unpaid POS” copy, swallowed loads, 2099 close, open guide, clipped tab | PAYROLL-DEEP-AUDIT P1-5/8/9 | **Closed** | Paid-unclaimed copy; toasts; date filter; guide closed; Advances |
| BUG-035 | High | Finance | Default This month showed ₱0 while Aug 8 had paid POS | FINANCE-DEEP-AUDIT P0-1 | **Closed** | Default last 30 days + last-paid cue |
| BUG-036 | High | Finance / Reports | Retention listed lifetime customers inside a windowed header | FINANCE-DEEP-AUDIT P0-2 | **Closed** | `retentionInWindow`; crew KPI labeled roster |
| BUG-037 | Medium | Finance | Inverted custom range queried without error | FINANCE-DEEP-AUDIT P0-3 | **Closed** | `validateFinanceCustomRange` + inline error |
| BUG-038 | Medium | Finance / UX | 11 tabs clipped Reports; filters not in URL; guide open | FINANCE-DEEP-AUDIT P1-1/2/3 | **Closed** | 5 primary + More; URL filters; guide closed |
| BUG-039 | Medium | Finance | Vendors tab stuck on skeleton | FINANCE-DEEP-AUDIT P1-5 | **Closed** | Stable vendor callback + error empty |
| BUG-040 | Medium | Finance / honesty | No unposted-pay cue; Categories looked like commission setup | FINANCE-DEEP-AUDIT P1-9 | **Closed** | Payroll/POS cues; P&L-bucket copy |
| BUG-041 | Low | Finance / UX | CSV/Excel/PDF × 5 on Reports; duplicate P&L Compare; ₱0 quotes | FINANCE-DEEP-AUDIT P1-7 / P2 | **Closed** | CSV-only ledgers; Dashboard trio; quote > 0 |

## Severity guide

- **Critical** — data loss, auth bypass, wrong money posted
- **High** — core workflow broken or false-green in production
- **Medium** — feature gap / ops blocker without workaround
- **Low** — hygiene, redundancy, cosmetic

## How to add

1. Reproduce with one command.
2. Add a row (next ID).
3. Link fix commit when closed.
