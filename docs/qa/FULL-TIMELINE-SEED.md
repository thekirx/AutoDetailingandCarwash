# June 2025 – November 2026 Full-System Seed & Multi-Month Scale Guide

Deterministic 18-month dataset (`2025-06` through `2026-11`) covering **all 11 staff roles** (`BossMich`, `assistant_super_admin`, `admin`, `team_lead`, `sales`, `marketing`, `investor`, `operations_lead`, `staff`, `detailer`, `video_editor`) and **`customer`** workflows across `bacoor` and `batangas`.

## Safety & Tag Isolation

- **Tag:** `[seed:jun2025-nov2026]` on every seeded text/note column (`customers.notes`, `bookings.notes`, `sales.notes`, `expenses.description`, `daily_sheets.notes`, `payslips.note`, `plan_cards.body`, `ops_form_submissions.payload`, `contact_inquiries.message`, `service_reviews.comment`, `restock_requests.notes`, `notification_broadcasts.body`).
- **Zero Outbound SMS:** Every seeded customer is created with `notify_sms = false` and `notify_push = false`, and every seeded booking is inserted directly in its terminal status (`completed`, `cancelled`, `no_show`, or `confirmed`) so completion-SMS triggers never fire.
- **September 2026 Coexistence:** By default, daily queue/POS/sheet generation skips `2026-09` so it never double-counts `[seed:sep2026]` if the September 2026 seed is already loaded, while still generating `2026-09` semi-monthly office `payslips`, `payroll_period_locks`, `plan_cards`, `restock_requests`, `inventory_recons`, `ops_form_submissions`, and `contact_inquiries`. Pass `--include-sep` if seeding an empty database without `[seed:sep2026]`.

## Commands

```bash
# 1. Dry run (default — prints full 18-month plan & role summary, touches nothing)
node scripts/seed-full-timeline.mjs

# 2. Dry run including September 2026 daily ops
node scripts/seed-full-timeline.mjs --include-sep

# 3. Dry run with every calendar day per month (full 536-day density)
node scripts/seed-full-timeline.mjs --days=30 --include-sep

# 4. Apply to Supabase (requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
node scripts/seed-full-timeline.mjs --apply
```

## Cleanup

Run [`scripts/seed/wipe-full-timeline.sql`](../../scripts/seed/wipe-full-timeline.sql) in the Supabase SQL Editor as a single transaction. It deletes only `[seed:jun2025-nov2026]` rows and leaves `[seed:sep2026]` and live user rows untouched.

## What Is Generated (Standard 18-Month Plan)

| Domain / Table | Standard Count | Roles Exercised |
| --- | ---: | --- |
| `customers` (`notify_sms=false`) | `921` | `customer`, `admin`, `sales`, `marketing` |
| `vehicles` (`FTC*` / `FTT*`) | `921` | `customer`, `admin`, `team_lead` |
| `customer_memberships` | `355` | `customer`, `admin`, `BossMich` |
| `loyalty_ledger` | `921` | `customer`, `admin` |
| `customer_referrals` + `customer_referral_rewards` | `34` + `34` | `customer`, `marketing`, `admin` |
| `customer_birthday_perks` + `customer_notes` | `34` + `34` | `customer`, `admin`, `sales` |
| `bookings` (Wash & Detailing) | `2,014` | `admin`, `team_lead`, `staff`, `detailer`, `customer` |
| `staff_attendance` | `1,200` | `admin`, `team_lead`, `detailer`, `staff` |
| `vehicle_maintenance_schedules` | `27` | `detailer`, `team_lead`, `admin`, `customer` |
| `sales` (`paid` / `refunded` / `voided`) | `2,135` (`₱3,776,126.00` net) | `admin`, `assistant_super_admin`, `BossMich`, `investor` |
| `sale_line_items` | `2,733` | `admin`, `assistant_super_admin`, `BossMich`, `investor` |
| `daily_sheets` (`bacoor` & `batangas`) | `200` | `admin`, `assistant_super_admin`, `BossMich` |
| `expenses` (Monthly Bills: Rent, Power, Fiber) | `100` | `BossMich`, `assistant_super_admin`, `investor` |
| `payslips` + ` salary_monthly` `expenses` | `468` (`₱5,042,000.00`) | `BossMich`, `assistant_super_admin`, `admin`, `operations_lead`, `sales`, `marketing`, `video_editor` |
| `payroll_period_locks` | `70` | `BossMich`, `assistant_super_admin` |
| `plan_cards` + `plan_card_assignees` | `72` | `video_editor`, `marketing`, `sales`, `operations_lead`, `BossMich` |
| `ops_form_submissions` | `36` | `team_lead`, `operations_lead`, `admin` |
| `restock_requests` + `inventory_recons` | `36` + `36` | `admin`, `assistant_super_admin`, `BossMich` |
| `contact_inquiries` + `service_reviews` | `36` + `100` | `sales`, `admin`, `customer` |
| `notification_broadcasts` | `18` | `marketing`, `BossMich` |
