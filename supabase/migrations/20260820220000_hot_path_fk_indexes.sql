-- OPT-06: cover unindexed FKs on floor / money / membership hot paths.
-- Advisor: unindexed_foreign_keys. Regular CREATE INDEX (apply_migration is transactional).

-- Bookings staff audit FKs (joins / CASCADE checks)
create index if not exists bookings_created_by_idx on public.bookings (created_by) where created_by is not null;
create index if not exists bookings_team_lead_id_idx on public.bookings (team_lead_id) where team_lead_id is not null;
create index if not exists bookings_final_checked_by_idx on public.bookings (final_checked_by) where final_checked_by is not null;
create index if not exists bookings_redo_by_idx on public.bookings (redo_by) where redo_by is not null;
create index if not exists bookings_sent_to_payment_by_idx on public.bookings (sent_to_payment_by) where sent_to_payment_by is not null;
create index if not exists bookings_price_edited_by_idx on public.bookings (price_edited_by) where price_edited_by is not null;

-- Floor / POS
create index if not exists queue_assignments_assigned_by_idx on public.queue_assignments (assigned_by) where assigned_by is not null;
create index if not exists queue_events_changed_by_idx on public.queue_events (changed_by) where changed_by is not null;
create index if not exists pos_handoffs_handed_off_by_idx on public.pos_handoffs (handed_off_by) where handed_off_by is not null;
create index if not exists pos_handoffs_transaction_id_idx on public.pos_handoffs (transaction_id) where transaction_id is not null;
create index if not exists staff_attendance_marked_by_idx on public.staff_attendance (marked_by) where marked_by is not null;

-- CRM / membership / reviews
create index if not exists customer_memberships_customer_id_idx on public.customer_memberships (customer_id);
create index if not exists customer_memberships_tier_id_idx on public.customer_memberships (tier_id);
create index if not exists service_reviews_customer_id_idx on public.service_reviews (customer_id) where customer_id is not null;

-- Ledger
create index if not exists transactions_customer_id_idx on public.transactions (customer_id) where customer_id is not null;
create index if not exists transactions_vehicle_id_idx on public.transactions (vehicle_id) where vehicle_id is not null;
create index if not exists transactions_recorded_by_idx on public.transactions (recorded_by) where recorded_by is not null;
create index if not exists payroll_run_lines_expense_id_idx on public.payroll_run_lines (expense_id) where expense_id is not null;

-- Planner / forms
create index if not exists plan_cards_created_by_idx on public.plan_cards (created_by) where created_by is not null;
create index if not exists plan_card_assignees_assigned_by_idx on public.plan_card_assignees (assigned_by) where assigned_by is not null;
create index if not exists ops_form_submissions_created_by_idx on public.ops_form_submissions (created_by) where created_by is not null;
