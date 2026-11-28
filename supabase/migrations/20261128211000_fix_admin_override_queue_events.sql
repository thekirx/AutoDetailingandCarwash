-- ============================================================================
-- Fix public.admin_override_queue_status() inserting into nonexistent
-- queue_events columns (event_type, actor_id, note, payload) introduced by
-- 20261127200000_revision_qa_checklist_fixes.sql.
-- Actual public.queue_events columns are:
-- (booking_id, branch, old_status, new_status, changed_by, notes, created_at).
-- ============================================================================

create or replace function public.admin_override_queue_status(
  input_booking_id uuid,
  input_next_status text,
  input_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  booking_row public.bookings%rowtype;
  prior_status text;
  group_ids uuid[];
  b_id uuid;
  b_branch text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select role::text into caller_role from public.staff_profiles where id = auth.uid();
  if caller_role not in ('admin', 'BossMich', 'assistant_super_admin', 'operations_lead', 'team_lead') then
    raise exception 'Only authorized operations or POS staff can override queue status';
  end if;

  if input_next_status not in ('waiting', 'in_progress', 'final_checking', 'redo', 'for_payment', 'cancelled') then
    raise exception 'Unsupported override status %', input_next_status;
  end if;

  select * into booking_row from public.bookings where id = input_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if caller_role not in ('BossMich', 'assistant_super_admin', 'operations_lead')
     and not public.user_has_branch_access(booking_row.branch::text) then
    raise exception 'Cross-branch queue override denied';
  end if;

  prior_status := booking_row.status::text;

  if booking_row.visit_group_id is not null then
    select array_agg(b.id order by b.created_at)
      into group_ids
    from public.bookings b
    where b.visit_group_id = booking_row.visit_group_id
      and coalesce(b.is_archived, false) = false;
  else
    group_ids := array[booking_row.id];
  end if;

  update public.bookings
  set status = input_next_status::booking_status,
      waiting_at = case when input_next_status = 'waiting' and waiting_at is null then now() else waiting_at end,
      in_progress_at = case when input_next_status = 'in_progress' then coalesce(in_progress_at, now()) else in_progress_at end,
      final_checking_at = case when input_next_status = 'final_checking' then now() else final_checking_at end,
      redo_at = case when input_next_status = 'redo' then now() else redo_at end,
      for_payment_at = case when input_next_status = 'for_payment' then now() else for_payment_at end,
      cancelled_at = case when input_next_status = 'cancelled' then now() else cancelled_at end
  where id = any(group_ids);

  if input_next_status <> 'for_payment' then
    update public.pos_handoffs
    set status = 'cancelled',
        updated_at = now()
    where booking_id = any(group_ids)
      and status = 'pending';

    update public.transactions
    set status = 'cancelled',
        updated_at = now()
    where booking_id = any(group_ids)
      and status = 'pending_payment';
  end if;

  foreach b_id in array group_ids loop
    select b.branch::text into b_branch from public.bookings b where b.id = b_id;
    insert into public.queue_events (
      booking_id,
      branch,
      old_status,
      new_status,
      changed_by,
      notes
    )
    values (
      b_id,
      coalesce(b_branch, booking_row.branch::text),
      prior_status,
      input_next_status,
      auth.uid(),
      'Admin override' || case when nullif(trim(coalesce(input_reason, '')), '') is null
        then '' else ': ' || trim(input_reason) end
    );
  end loop;

  return jsonb_build_object(
    'booking_id', booking_row.id,
    'visit_group_id', booking_row.visit_group_id,
    'from_status', prior_status,
    'to_status', input_next_status
  );
end;
$$;

grant execute on function public.admin_override_queue_status(uuid, text, text) to authenticated;
