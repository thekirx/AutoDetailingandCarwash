# Queue Production Fix Verification

Run these checks after applying `supabase/migrations/20260707132730_queue_production_schema_cache_fix.sql` to Supabase.

1. Create a queue ticket as `team_lead` or `BossMich`.
   - Expected: ticket starts with status `waiting` and appears in Active Queue.

2. Click `Start Service`.
   - Expected: status becomes `in_progress`; no raw Supabase error appears.

3. Click `Send To Final Checking`.
   - Expected: status becomes `final_checking`, `bookings.final_checking_at` is populated, and `final_checked_by` is populated when the logged-in user has a matching `public.customers` row.

4. Click `Send To Payment`.
   - Expected: status becomes `for_payment`, `for_payment_at` and `sent_to_payment_by` are populated, active staff assignments are released, and the ticket disappears from Active Queue.

5. Inspect `public.transactions`.
   - Expected: exactly one non-archived transaction exists for the `booking_id`; `recorded_by` is a valid `public.customers.id`; `type = 'sale'`; `status = 'pending_payment'`; `payment_method = 'pending'`.

6. Click `Send To Payment` again for the same booking through any available direct route.
   - Expected: no duplicate transaction is created; the existing transaction is reused/updated.

7. Test with a Team Lead auth user that has no matching `public.customers` row.
   - Expected: UI shows `Your user profile is missing. Ask Super Admin to create or sync your profile before sending to payment.` and no FK violation is shown to the user.

8. Confirm POS/admin pending payment visibility.
   - Expected: the pending transaction is returned by `public.get_pending_payment_transactions(...)` and is available for the future POS payment flow.
