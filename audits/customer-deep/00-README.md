# Customer — Deep Audit

**Role:** `customer`  
**Home:** `/account`  
**Scope:** Own profile / bookings / vehicles / loyalty / purchases (via `/api/customer-portal` service role)  
**Public surfaces:** `/`, `/book`, `/queue`, `/queue/:branch`, `/contact`, `/complaints`, `/events`, `/signin`, `/signup`, `/account/set-password`

## Done definition

1. Capability matrix documented  
2. CRITICAL/HIGH defects ranked with file:line evidence  
3. Ops API reachability from customer checked  
4. Live RLS / realtime publication verified via Supabase SQL  

## Contents

| File | Purpose |
|------|---------|
| `01-route-matrix.md` | Expected customer capabilities from code |
| `02-defects-and-fixes.md` | Ranked CUST-C* / CUST-H* findings |
| `03-verification.md` | Live SQL + code evidence |

## Trust boundaries

| Path | Auth | Notes |
|------|------|-------|
| Public site + `/book` | Anon OK | Booking via `/api/public-book` (service role) |
| `/queue/:branch` | Anon OK | Views + realtime on `bookings` |
| `/account` | JWT + `customers.role=customer` | Portal API enforces DB role (not metadata) |
| `/api/customer-portal` | Bearer customer | Own-row mutations only |
| Ops APIs (`booking-status`, `provision-customer`, `busybee`, POS UI) | Staff `staff_profiles` | Customer → 403 (verified in code) |
