# Role × story × evidence (2026-10-05)

Strict principal matrix: what is **proven**, what is **nav-only**, what is **blocked**.  
SMS is **out of scope** for this pass (BrandTxt IP still open). Push **routing** is proven; **device delivery** needs staff opt-in.

## Legend

| Tag | Meaning |
|-----|---------|
| **PROVEN** | Fresh or recent automated evidence named below |
| **NAV** | `e2e:nav-walk` / `e2e:role-qa` page load + allow/deny only |
| **DOC** | Story rewritten to Daily Sheet; seam test or guide exists |
| **GAP** | Not deeply accepted this campaign |
| **OPS** | Needs human/device/dashboard — not a code bug |

## Money path (all branches live: Bacoor, Batangas; Dasma coming soon)

| Story | Status | Evidence |
|-------|--------|----------|
| US-DOPS queue → POS | **PROVEN** | Role probe 20/20; FLOPS historical; Daily Sheet money 38/38 |
| US-CLOSE Daily Sheet | **PROVEN** + **DOC** | `e2e:daily-sheet-money`, unique `(branch, business_date)`, guides updated |
| US-PAY via sheet | **PROVEN** + **DOC** | dailySheet tests; US-PAY-03 source scan |
| US-FIN books | **PROVEN** | Finance page seams; September verify 23/23; Floor Board shots |
| Push sheet_submitted / reviewed | **PROVEN** routing · **OPS** delivery | `notificationRecipients.test.js`; **0 staff** `push_subscriptions` |

## Personas

| Role | Home | Stories deep | Nav/RBAC | Notes |
|------|------|--------------|----------|-------|
| Super Admin | `/operations/console` | Money + People hire **PROVEN** | **PROVEN** 52/52 | Enable push on phone (**OPS**) |
| ASA | console | Finance grant paths **PROVEN** | **PROVEN** | Same push **OPS** |
| Branch Admin | `/operations/pos` | Daily Sheet **PROVEN** | **PROVEN**; Queue deny by design | Seed Batangas BA exists |
| Team Lead | `/operations/queue` | Status/override **PROVEN** probe | **PROVEN** | |
| Crew / Detailer | attendance / bookings | Attendance in seed | **NAV** | Detailer branch picker **fixed** |
| Sales / Marketing / Video | bookings / crm / planning | | **NAV** | Deep CRUD **GAP** |
| Ops Lead | roadmap | | **NAV** | Money panel scope decision open |
| Investor | finance | RO finance | **NAV** | |
| Customer | `/account` | Demo account smoke | **NAV** | Seed customers **no portal auth** |

## Database / Supabase consistency

| Check | Status |
|-------|--------|
| Live branches: `bacoor`, `batangas`, `hq` (private), `dasmarinas` coming soon | **PROVEN** (SQL 2026-10-05) |
| Junk `crudtest-*` archived | **PROVEN** |
| Hot RLS initPlan (sales/bookings/queue_events) | **PROVEN** fingerprint |
| TL final-check FK → staff | **PROVEN** |
| September seed tagged wipeable | **PROVEN** · wipe before go-live = owner |

## Branding

| Surface | Status |
|---------|--------|
| Public homepage branch cards + Dasmariñas spelling | **PROVEN** `homeBranches.test.js` |
| Ops shells / Daily Sheet | Uses existing Hakum ops DS (no redesign this pass) |
| Google review thumbs links | **OPS** — 0 branches have `https://` review URL |

## Push: who should get what (no SMS)

See [PUSH-CHECKLIST.md](./PUSH-CHECKLIST.md). Hard gate before soft-launch night:

1. BossMich + approving ASA + each BA: Account → **Enable alerts** + Test alert  
2. Re-run `PUSH_AUDIT=1` browser audit when devices exist (do **not** blast demo customer phones casually)  
3. Confirm sheet submit toast on SA/ASA and approve toast on BA  

Until step 1, code can be correct and phones stay silent.

## Continue after this doc pass

1. Staff enable push (OPS)  
2. Persona deep QA (Sales / Marketing / Video / Customer portal)  
3. Rewrite `e2e:lifecycle-flops` for Daily Sheet  
4. SMS when BrandTxt IP ready (explicitly later)  
5. Owner: wipe September seed?  
